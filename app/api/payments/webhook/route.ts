import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('x-paystack-signature');
    const body = await req.text();

    console.log('[v0] Webhook received with signature:', signature);

    // Verify webhook signature
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '')
      .update(body)
      .digest('hex');

    if (hash !== signature) {
      console.error('[v0] Invalid webhook signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);
    console.log('[v0] Webhook event:', event.event);

    if (event.event === 'charge.success') {
      const { reference, amount, customer } = event.data;

      console.log('[v0] Processing charge.success for reference:', reference);

      // Update order status to paid
      const orderResult = await db.query(
        `UPDATE orders 
         SET payment_status = $1, payment_reference = $2, status = $3
         WHERE payment_reference = $4 OR id = $5
         RETURNING id, business_id, total_amount`,
        ['completed', reference, 'confirmed', reference, '']
      );

      if (orderResult && orderResult.length > 0) {
        const order = orderResult[0];
        console.log('[v0] Order updated:', order.id);

        // Record transaction
        const transactionId = `txn_${Date.now()}`;
        await db.query(
          `INSERT INTO transactions (id, business_id, order_id, transaction_type, amount, payment_reference, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [
            transactionId,
            order.business_id,
            order.id,
            'payment',
            order.total_amount,
            reference,
            'completed',
          ]
        );

        // Update business available balance
        await db.query(
          `UPDATE businesses 
           SET available_balance = available_balance + $1
           WHERE id = $2`,
          [order.total_amount, order.business_id]
        );

        console.log('[v0] Business balance updated');
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[v0] Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Handle GET requests - used for redirect from Paystack payment success
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const reference = searchParams.get('reference');
    const trxref = searchParams.get('trxref');

    console.log('[v0] Webhook GET request - reference:', reference, 'trxref:', trxref);

    // Redirect to payment success page with the reference
    const paymentRef = reference || trxref;
    if (paymentRef) {
      return NextResponse.redirect(new URL(`/payment-success?reference=${paymentRef}`, req.url));
    }

    return NextResponse.json({ error: 'No reference provided' }, { status: 400 });
  } catch (error) {
    console.error('[v0] Webhook GET error:', error);
    return NextResponse.json({ error: 'Failed to process redirect' }, { status: 500 });
  }
}
