import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

const PAYSTACK_API_KEY = process.env.PAYSTACK_SECRET_KEY;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ refundId: string }> }
) {
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
    const resolvedParams = await params;
    const refundId = resolvedParams.refundId;

    if (!PAYSTACK_API_KEY) {
      return NextResponse.json(
        { error: 'Paystack API key not configured' },
        { status: 500 }
      );
    }

    // Get refund details and verify ownership
    const refundResult = await db.query(
      `SELECT r.id, r.transaction_id, r.amount, r.status, o.id as order_id
       FROM refunds r
       JOIN orders o ON r.order_id = o.id
       JOIN businesses b ON o.business_id = b.id
       WHERE r.id = $1 AND b.owner_id = $2`,
      [refundId, userId]
    );

    if (!refundResult || refundResult.length === 0) {
      return NextResponse.json(
        { error: 'Refund not found or not authorized' },
        { status: 404 }
      );
    }

    const refund = refundResult[0];

    if (refund.status !== 'failed') {
      return NextResponse.json(
        { error: 'Can only retry failed refunds' },
        { status: 400 }
      );
    }

    // Retry with Paystack
    const params = JSON.stringify({
      refund: refund.transaction_id,
    });

    try {
      const response = await fetch('https://api.paystack.co/refund/retry_with_customer_details', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PAYSTACK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: params,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[v0] Paystack retry error:', data);
        return NextResponse.json(
          { error: data.message || 'Paystack retry failed' },
          { status: 400 }
        );
      }

      // Update refund status to completed
      await db.query(
        `UPDATE refunds SET status = $1, paystack_refund_id = $2, failure_reason = NULL, updated_at = NOW() WHERE id = $3`,
        ['completed', data.data?.id || data.data?.reference, refundId]
      );

      console.log('[v0] Refund retry successful:', refundId);

      return NextResponse.json({
        success: true,
        message: 'Refund retry processed successfully',
      });
    } catch (paystackError) {
      console.error('[v0] Paystack retry error:', paystackError);
      const errorMessage = paystackError instanceof Error ? paystackError.message : 'Unknown error';

      // Update with new failure reason
      await db.query(
        `UPDATE refunds SET failure_reason = $1, updated_at = NOW() WHERE id = $2`,
        [errorMessage, refundId]
      );

      return NextResponse.json(
        { error: 'Failed to retry refund: ' + errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[v0] Refund retry error:', error);
    return NextResponse.json(
      { error: 'Failed to retry refund' },
      { status: 500 }
    );
  }
}
