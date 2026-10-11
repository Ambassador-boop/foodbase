import { NextRequest, NextResponse } from 'next/server';
import { initializePayment, generatePaymentReference } from '@/lib/paystack';
import { db, getOne } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { orderId } = await request.json();
    if (typeof orderId !== 'string' || !orderId.trim()) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    const order = await getOne(
      `SELECT id, business_id, total_amount, payment_status, customer_email
         FROM orders WHERE id = $1`,
      [orderId],
    );
    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.payment_status === 'paid' || order.payment_status === 'completed') {
      return NextResponse.json({ error: 'Order has already been paid' }, { status: 409 });
    }

    const amount = Number(order.total_amount);
    if (!(amount > 0) || typeof order.customer_email !== 'string' || !order.customer_email.trim()) {
      return NextResponse.json({ error: 'Order has an invalid amount or customer email' }, { status: 400 });
    }

    const reference = generatePaymentReference();
    const updated = await db.query(
      `UPDATE orders SET payment_reference = $1, updated_at = NOW()
       WHERE id = $2 AND payment_status NOT IN ('paid', 'completed')
       RETURNING id`,
      [reference, orderId],
    );
    const rows = Array.isArray(updated) ? updated : updated?.rows ?? [];
    if (rows.length === 0) return NextResponse.json({ error: 'Order has already been paid' }, { status: 409 });

    const paystackResponse = await initializePayment(amount, order.customer_email.trim(), reference, { orderId });
    return NextResponse.json({
      success: true,
      reference,
      authorizationUrl: paystackResponse.data.authorization_url,
      accessCode: paystackResponse.data.access_code,
    });
  } catch (error) {
    console.error('[v0] Payment initialization error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize payment', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
