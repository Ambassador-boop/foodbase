import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('x-paystack-signature');
    const body = await req.text();

    // Verify webhook signature
    const hash = crypto
      .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || '')
      .update(body)
      .digest('hex');

    if (hash !== signature) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);

    if (event.event === 'charge.success') {
      const { reference, amount, customer } = event.data;

      // Update order status to paid
      const orderResult = await sql.query(
        `UPDATE orders 
         SET status = 'confirmed', payment_reference = $1
         WHERE id = (SELECT id FROM orders WHERE paystack_reference = $2)
         RETURNING id, business_id, total_amount`,
        ['paid', reference]
      );

      if (orderResult.rows.length > 0) {
        const order = orderResult.rows[0];

        // Record transaction
        const transactionId = `txn_${Date.now()}`;
        await sql.query(
          `INSERT INTO transactions (id, business_id, type, amount, description, reference, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [
            transactionId,
            order.business_id,
            'income',
            order.total_amount,
            'Order payment received',
            reference,
          ]
        );

        // Update business available balance
        await sql.query(
          `UPDATE businesses 
           SET available_balance = available_balance + $1
           WHERE id = $2`,
          [order.total_amount, order.business_id]
        );
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
