import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { nanoid } from 'nanoid';

const PAYSTACK_API_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';

async function paystackRefund(transactionRef: string, amountKobo: number, opts: {
  customer_note?: string;
  merchant_note?: string;
}) {
  const res = await fetch(`${PAYSTACK_BASE}/refund`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      transaction: transactionRef,
      amount: amountKobo,
      currency: 'NGN',
      customer_note: opts.customer_note,
      merchant_note: opts.merchant_note,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || 'Refund failed');
  }
  return json.data;
}

export async function POST(request: NextRequest) {
  try {
    const token =
      request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const userId = (payload as any).userId || (payload as any).id;

    const body = await request.json();
    const { orderId, amount, reason, notes } = body;

    if (!orderId || !amount || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    /* -------- Order ownership + payment check ------------------- */
    const orderRows: any = await db.query(
      `SELECT
         o.id, o.total_amount, o.payment_status, o.payment_reference,
         o.customer_name, b.id AS business_id
       FROM orders o
       JOIN businesses b ON o.business_id = b.id
       WHERE o.id = $1 AND b.owner_id = $2`,
      [orderId, userId],
    );
    const orderList = Array.isArray(orderRows) ? orderRows : orderRows?.rows ?? [];
    if (orderList.length === 0) {
      return NextResponse.json(
        { error: 'Order not found or not authorized' },
        { status: 404 },
      );
    }
    const order = orderList[0];
    // 🔍 Get actual transaction ID from transactions table using order_id
    const txRows: any = await db.query(
      `SELECT id FROM transactions WHERE order_id = $1 LIMIT 1`,
      [orderId],
    );
    const txList = Array.isArray(txRows) ? txRows : txRows?.rows ?? [];

    if (txList.length === 0) {
      return NextResponse.json(
        { error: 'No transaction found for this order' },
        { status: 404 },
      );
    }

    const transactionId = txList[0].id;
    const refundAmount = Number(amount);
    const orderTotal = Number(order.total_amount ?? 0);

    if (refundAmount <= 0 || refundAmount > orderTotal) {
      return NextResponse.json(
        { error: 'Refund amount cannot exceed the original transaction amount.' },
        { status: 400 },
      );
    }
    // Payments can be marked as either 'paid' (newer flow) or 'completed' (legacy)
    if (!['paid', 'completed', 'success'].includes(order.payment_status)) {
      return NextResponse.json(
        {
          error: `Can only refund completed payments (current status: ${order.payment_status || 'unknown'})`,
        },
        { status: 400 },
      );
    }

    /* -------- Already-refunded check ---------------------------- */
    const existingRows: any = await db.query(
      `SELECT COALESCE(SUM(refund_amount), 0) AS already_refunded
         FROM refunds
        WHERE order_id = $1 AND status NOT IN ('failed','rejected')`,
      [orderId],
    );
    const existingList = Array.isArray(existingRows)
      ? existingRows
      : existingRows?.rows ?? [];
    const alreadyRefunded = Number(existingList[0]?.already_refunded ?? 0);
    if (alreadyRefunded + refundAmount > orderTotal) {
      return NextResponse.json(
        {
          error: `Only ₦${(orderTotal - alreadyRefunded).toLocaleString()} can still be refunded on this order.`,
        },
        { status: 400 },
      );
    }

    const refundId = `rf_${nanoid(14)}`;
    const merchantNote = `Refund for order ${orderId} — reason: ${reason}`;
    const customerNote = `Refund issued for your order. ${notes || ''}`.trim();

    /* -------- Insert refund row --------------------------------- */
    await db.query(
      `INSERT INTO refunds
        (id, order_id, transaction_id, business_id,
         original_amount, refund_amount, amount,
         reason, notes, customer_note, merchant_note,
         status, requested_at, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending',NOW(),NOW(),NOW())`,
      [
        refundId,
        orderId,
        order.payment_reference,
        order.business_id,
        orderTotal,
        refundAmount,
        Math.round(refundAmount * 100), // legacy integer column in kobo
        reason,
        notes || null,
        customerNote,
        merchantNote,
      ],
    );

    /* -------- Initiate Paystack refund -------------------------- */
    if (!PAYSTACK_API_KEY || !order.payment_reference) {
      // Without Paystack we can only persist the request
      return NextResponse.json({
        success: true,
        refundId,
        status: 'pending',
        message: 'Refund request created.',
      });
    }

    try {
      const data = await paystackRefund(
        order.payment_reference,
        Math.round(refundAmount * 100),
        { customer_note: customerNote, merchant_note: merchantNote },
      );

      await db.query(
        `UPDATE refunds
            SET paystack_refund_id = $1,
                status = $2,
                channel = $3,
                deducted_amount = $4,
                fully_deducted = $5,
                expected_at = $6,
                updated_at = NOW()
          WHERE id = $7`,
        [
          String(data.id ?? ''),
          data.status || 'pending', // pending | processing | needs-attention | failed | processed
          data.channel || null,
          data.deducted_amount != null ? Number(data.deducted_amount) / 100 : null,
          !!data.fully_deducted,
          data.expected_at || null,
          refundId,
        ],
      );

      return NextResponse.json({
        success: true,
        refundId,
        status: data.status || 'pending',
        message: 'Refund queued for processing.',
      });
    } catch (err: any) {
      console.error('[v0] Paystack refund error:', err);
      const errMsg = err?.message?.slice(0, 500) || 'Refund failed';
      await db.query(
        `UPDATE refunds
            SET status = 'failed',
                failure_reason = $1,
                updated_at = NOW()
          WHERE id = $2`,
        [errMsg, refundId],
      );
      return NextResponse.json(
        {
          success: false,
          refundId,
          status: 'failed',
          error: errMsg,
        },
        { status: 502 },
      );
    }
  } catch (err) {
    console.error('[v0] /refunds/request error:', err);
    return NextResponse.json(
      { error: 'Failed to process refund' },
      { status: 500 },
    );
  }
}
