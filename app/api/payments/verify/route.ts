import { NextRequest, NextResponse } from 'next/server';
import { verifyPayment } from '@/lib/paystack';
import { getOne } from '@/lib/db';
import { settlePaystackPayment } from '@/lib/payments/settle';
import { sendOrderStatusNotification } from '@/lib/notification-service';

export async function POST(request: NextRequest) {
  try {
    const { reference } = await request.json();
    if (typeof reference !== 'string' || !reference.trim() || reference.length > 100) {
      return NextResponse.json({ error: 'Reference is required' }, { status: 400 });
    }

    const paystackResponse = await verifyPayment(reference);
    if (!paystackResponse?.status || paystackResponse.data?.status !== 'success') {
      return NextResponse.json(
        { error: 'Payment was not successful', status: paystackResponse?.data?.status },
        { status: 400 },
      );
    }

    const result = await settlePaystackPayment(paystackResponse.data);
    if (result.status === 'amount_mismatch') {
      return NextResponse.json({ error: 'Payment amount does not match the order. Contact support with your reference.' }, { status: 400 });
    }
    if (result.status === 'order_not_found') {
      return NextResponse.json({ error: 'Order not found for this reference' }, { status: 404 });
    }
    if (result.status !== 'settled' && result.status !== 'already_settled') {
      return NextResponse.json({ error: 'Payment settlement failed' }, { status: 500 });
    }

    const orderId = String(result.order_id ?? '');
    const order = await getOne(
      `SELECT o.total_amount, b.slug FROM orders o JOIN businesses b ON b.id = o.business_id WHERE o.id = $1`,
      [orderId],
    );
    if (!order) return NextResponse.json({ error: 'Order not found for this reference' }, { status: 404 });

    if (result.status === 'settled') {
      try { await sendOrderStatusNotification(orderId, 'confirmed', 'paid'); } catch (error) {
        console.error('[v0] Payment notification failed:', error);
      }
    }

    return NextResponse.json({
      success: true,
      status: 'success',
      amount: Number(order.total_amount),
      reference,
      orderId,
      businessSlug: order.slug,
      message: result.status === 'already_settled' ? 'Order already settled' : 'Payment verified successfully',
      ...(result.status === 'already_settled' ? { alreadySettled: true } : {}),
    });
  } catch (error) {
    console.error('[v0] Verify payment error:', error);
    return NextResponse.json({ error: 'Failed to verify payment', details: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
