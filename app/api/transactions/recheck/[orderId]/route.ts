import { NextRequest, NextResponse } from 'next/server';
import { getOne } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { verifyPayment } from '@/lib/paystack';
import { settlePaystackPayment } from '@/lib/payments/settle';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyJWT(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    const userId = (payload as any).userId || (payload as any).id;
    const { orderId } = await params;
    const order = await getOne(
      `SELECT o.id, o.payment_status, o.payment_reference, b.owner_id
         FROM orders o JOIN businesses b ON b.id = o.business_id
        WHERE o.id = $1 AND b.owner_id = $2`,
      [orderId, userId],
    );
    if (!order) return NextResponse.json({ error: 'Order not found or not authorized' }, { status: 404 });
    if (order.payment_status === 'paid' || order.payment_status === 'completed') {
      return NextResponse.json({ ok: true, alreadySettled: true, message: 'Order already marked paid', paystackStatus: 'success' });
    }

    const reference = order.payment_reference;
    if (!reference) return NextResponse.json({ ok: false, paystackStatus: 'unknown', message: 'Order has no payment reference' });
    const paystackResponse = await verifyPayment(reference);
    if (!paystackResponse?.status) return NextResponse.json({ ok: false, paystackStatus: 'unknown', message: 'Could not reach Paystack' }, { status: 502 });
    if (paystackResponse.data?.status !== 'success') {
      return NextResponse.json({ ok: false, paystackStatus: paystackResponse.data?.status || 'pending', message: paystackResponse.data?.gateway_response || 'Paystack has not confirmed this payment yet' });
    }

    const result = await settlePaystackPayment(paystackResponse.data);
    if (result.status === 'amount_mismatch') return NextResponse.json({ ok: false, paystackStatus: 'success', message: 'Payment amount does not match the order' }, { status: 400 });
    if (result.status === 'order_not_found') return NextResponse.json({ ok: false, paystackStatus: 'success', message: 'Order not found for this payment' }, { status: 404 });
    if (result.status !== 'settled' && result.status !== 'already_settled') return NextResponse.json({ ok: false, message: 'Payment settlement failed' }, { status: 500 });
    return NextResponse.json({
      ok: true,
      paystackStatus: 'success',
      alreadySettled: result.status === 'already_settled',
      message: result.status === 'already_settled' ? 'Order already settled' : 'Payment confirmed and settled',
    });
  } catch (error) {
    console.error('[v0] recheck route error:', error);
    return NextResponse.json({ error: 'Recheck failed', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}
