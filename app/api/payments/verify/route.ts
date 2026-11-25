import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPayment } from '@/lib/paystack';
import { getOne } from '@/lib/db';
import { settlePaystackPayment } from '@/lib/payments/settle';
import { sendOrderStatusNotification } from '@/lib/notification-service';
import { notifyRestaurantPaidOrder } from '@/lib/paid-order-notification';
import { parseBody, fail } from '@/lib/api';
import { handleUnexpected } from '@/lib/api/handler';

const VerifyBody = z.object({
  reference: z.string().trim().min(1, 'Reference is required').max(100),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseBody(request, VerifyBody, 'That payment reference is not valid.');
    if (!parsed.ok) return parsed.response;
    const { reference } = parsed.data;

    const paystackResponse = await verifyPayment(reference);
    if (!paystackResponse?.status || paystackResponse.data?.status !== 'success') {
      return fail('PAYMENT_NOT_SUCCESSFUL', 'Payment was not successful', 400, undefined, {
        status: paystackResponse?.data?.status,
      });
    }

    const result = await settlePaystackPayment(paystackResponse.data);
    if (result.status === 'amount_mismatch') {
      return fail('AMOUNT_MISMATCH', 'Payment amount does not match the order. Contact support with your reference.', 400);
    }
    if (result.status === 'order_not_found') {
      return fail('ORDER_NOT_FOUND', 'Order not found for this reference', 404);
    }
    if (result.status !== 'settled' && result.status !== 'already_settled') {
      return fail('SETTLEMENT_FAILED', 'Payment settlement failed', 500);
    }

    const orderId = String(result.order_id ?? '');
    const order = await getOne(
      `SELECT o.total_amount, b.slug FROM orders o JOIN businesses b ON b.id = o.business_id WHERE o.id = $1`,
      [orderId],
    );
    if (!order) return fail('ORDER_NOT_FOUND', 'Order not found for this reference', 404);

    if (result.status === 'settled') {
      try { await sendOrderStatusNotification(orderId, 'confirmed', 'paid'); } catch (error) {
        console.error('[v0] Payment notification failed:', error);
      }
    }

    // Batch 3C: the restaurant's one "this order is paid" alert. `restaurant_notified_at`
    // is claimed with a single guarded UPDATE, so verify and the webhook racing each
    // other still produce exactly one push. It is also attempted on `already_settled`
    // so a notification that failed earlier repairs itself on the next look.
    try {
      await notifyRestaurantPaidOrder(orderId);
    } catch (error) {
      console.error('[v0] Paid order notification failed:', error);
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
    // `details` used to carry the raw error message to the browser; it is now
    // only in the server log, under the request id the customer sees.
    return handleUnexpected(error, { where: 'POST /api/payments/verify', request });
  }
}
