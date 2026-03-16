import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { generateAlphanumericId } from '@/lib/utils';

const PAYSTACK_API_KEY = process.env.PAYSTACK_SECRET_KEY;

async function makePaystackRefund(transactionId: string, amount: number) {
  if (!PAYSTACK_API_KEY) {
    throw new Error('Paystack API key not configured');
  }

  const refundParams = JSON.stringify({
    transaction: transactionId,
    amount: Math.round(amount * 100), // Convert to kobo
  });

  const response = await fetch('https://api.paystack.co/refund', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: refundParams,
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('[v0] Paystack refund error:', data);
    throw new Error(data.message || 'Paystack refund failed');
  }

  return data;
}

export async function POST(request: NextRequest) {
  try {
    const authCookie = request.cookies.get('auth_token')?.value;

    if (!authCookie) {
      return NextResponse.json({ error: 'No auth token found' }, { status: 401 });
    }

    const user = await verifyJWT(authCookie);

    if (!user) {
      return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 });
    }

    const userId = (user as any).userId || (user as any).id;
    const body = await request.json();
    const { orderId, amount, reason, notes } = body;

    if (!orderId || !amount || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify order belongs to the user's business
    const orderResult = await db.query(
      `SELECT o.id, o.total_amount, o.payment_status, o.payment_reference, b.id as business_id
       FROM orders o
       JOIN businesses b ON o.business_id = b.id
       WHERE o.id = $1 AND b.owner_id = $2`,
      [orderId, userId]
    );

    if (!orderResult || orderResult.length === 0) {
      return NextResponse.json(
        { error: 'Order not found or not authorized' },
        { status: 404 }
      );
    }

    const order = orderResult[0];

    // Validate refund amount
    if (amount <= 0 || amount > order.total_amount) {
      return NextResponse.json(
        { error: 'Invalid refund amount. Cannot exceed original transaction amount.' },
        { status: 400 }
      );
    }

    // Check if order has been paid
    if (order.payment_status !== 'completed') {
      return NextResponse.json(
        { error: 'Can only refund completed payments' },
        { status: 400 }
      );
    }

    // Create refund record in database
    const refundId = generateAlphanumericId();

    try {
      // First, create the refund record (this will track the refund)
      await db.query(
        `INSERT INTO refunds 
        (id, order_id, transaction_id, amount, status, reason, notes, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [refundId, orderId, order.payment_reference, amount, 'pending', reason, notes || null]
      );

      console.log('[v0] Refund record created:', refundId);

      // Attempt Paystack refund
      let paystackResponse = null;
      try {
        paystackResponse = await makePaystackRefund(order.payment_reference, amount);

        console.log('[v0] Paystack refund successful:', paystackResponse);

        // Update refund status to completed
        await db.query(
          `UPDATE refunds SET status = $1, paystack_refund_id = $2, updated_at = NOW() WHERE id = $3`,
          ['completed', paystackResponse.data?.id || paystackResponse.data?.reference, refundId]
        );
      } catch (paystackError) {
        console.error('[v0] Paystack refund error:', paystackError);

        // Update refund status to failed but keep record
        const errorMessage = paystackError instanceof Error ? paystackError.message : 'Unknown error';
        await db.query(
          `UPDATE refunds SET status = $1, failure_reason = $2, updated_at = NOW() WHERE id = $3`,
          ['failed', errorMessage, refundId]
        );

        // Still return success so user knows the request was recorded
        return NextResponse.json({
          success: true,
          refundId,
          message: 'Refund request created but Paystack processing failed. Please retry.',
          status: 'pending_retry',
        });
      }

      return NextResponse.json({
        success: true,
        refundId,
        message: 'Refund processed successfully',
      });
    } catch (dbError) {
      console.error('[v0] Database error creating refund:', dbError);
      return NextResponse.json(
        { error: 'Failed to create refund record' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[v0] Refund request error:', error);
    return NextResponse.json(
      { error: 'Failed to process refund' },
      { status: 500 }
    );
  }
}
