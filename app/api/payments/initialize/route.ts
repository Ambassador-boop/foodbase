import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { initializePayment, generatePaymentReference } from '@/lib/paystack';
import { db, getOne, rowsOf } from '@/lib/db';
import { parseBody, fail } from '@/lib/api';
import { handleUnexpected } from '@/lib/api/handler';
import { RATE_LIMITS, enforceRateLimit } from '@/lib/rate-limit';

const InitializeBody = z.object({
  orderId: z.string().trim().min(1, 'orderId is required').max(100),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseBody(request, InitializeBody, 'Choose an order to pay for.');
    if (!parsed.ok) return parsed.response;
    const { orderId } = parsed.data;

    // Checkout shares the order-creation allowance: 20 per 10 minutes per IP.
    const limited = await enforceRateLimit(request, RATE_LIMITS.checkoutIp);
    if (limited) return limited;

    const order = await getOne(
      `SELECT id, business_id, total_amount, payment_status, customer_email
         FROM orders WHERE id = $1`,
      [orderId],
    );
    if (!order) return fail('ORDER_NOT_FOUND', 'Order not found', 404);
    if (order.payment_status === 'paid' || order.payment_status === 'completed') {
      return fail('ORDER_ALREADY_PAID', 'Order has already been paid', 409);
    }

    const amount = Number(order.total_amount);
    if (!(amount > 0) || typeof order.customer_email !== 'string' || !order.customer_email.trim()) {
      return fail('ORDER_INVALID', 'Order has an invalid amount or customer email', 400);
    }

    const reference = generatePaymentReference();
    const updated = await db.query(
      `UPDATE orders SET payment_reference = $1, updated_at = NOW()
       WHERE id = $2 AND payment_status NOT IN ('paid', 'completed')
       RETURNING id`,
      [reference, orderId],
    );
    const rows = rowsOf<{ id: string }>(updated);
    if (rows.length === 0) return fail('ORDER_ALREADY_PAID', 'Order has already been paid', 409);

    const paystackResponse = await initializePayment(amount, order.customer_email.trim(), reference, { orderId });
    return NextResponse.json({
      success: true,
      reference,
      authorizationUrl: paystackResponse.data.authorization_url,
      accessCode: paystackResponse.data.access_code,
    });
  } catch (error) {
    // The provider's own message is deliberately not passed on: it can name
    // internal keys. The reference and order are still in the server log.
    return handleUnexpected(error, { where: 'POST /api/payments/initialize', request });
  }
}
