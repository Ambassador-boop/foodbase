import { NextRequest, NextResponse } from 'next/server';
import { db, getOne, query } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { verifyPayment } from '@/lib/paystack';
import { generateAlphanumericId } from '@/lib/utils';
import { computeAvailableAt } from '@/lib/wat';

/**
 * POST /api/transactions/recheck/[orderId]
 *
 * Re-queries Paystack for the order's payment reference and, if Paystack
 * reports success, settles the order using the same flow as
 * /api/payments/verify — with one twist:
 *
 *   - If the order was paid more than 24 hours ago (anything older than a
 *     day, per the spec), credit available_balance directly — those funds
 *     are past their settlement window. Otherwise credit pending_balance
 *     and stamp a fresh available_at timestamp.
 *
 * Idempotent: re-running on an already paid order is a no-op.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
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
    const { orderId } = await params;

    // Verify ownership and pull the order
    const order = await getOne(
      `SELECT o.id, o.business_id, o.total_amount, o.service_fee_amount,
              o.payment_status, o.payment_reference, o.customer_name,
              o.created_at
         FROM orders o
         JOIN businesses b ON o.business_id = b.id
        WHERE o.id = $1 AND b.owner_id = $2`,
      [orderId, userId],
    );

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found or not authorized' },
        { status: 404 },
      );
    }

    // Already settled? Nothing to do.
    if (
      order.payment_status === 'paid' ||
      order.payment_status === 'completed'
    ) {
      return NextResponse.json({
        ok: true,
        alreadySettled: true,
        message: 'Order already marked paid',
        paystackStatus: 'success',
      });
    }

    // Use payment_reference if we have one; otherwise fall back to id (the
    // checkout flow uses orderId as the Paystack reference).
    const reference = order.payment_reference || order.id;

    let paystackData: any = null;
    try {
      const ps = await verifyPayment(reference);
      if (!ps?.status) {
        return NextResponse.json(
          {
            ok: false,
            paystackStatus: 'unknown',
            message: 'Could not reach Paystack',
          },
          { status: 502 },
        );
      }
      paystackData = ps.data;
    } catch (err) {
      console.error('[v0] recheck verifyPayment error:', err);
      return NextResponse.json(
        {
          ok: false,
          paystackStatus: 'error',
          message: err instanceof Error ? err.message : String(err),
        },
        { status: 502 },
      );
    }

    const psStatus = String(paystackData?.status || '').toLowerCase();

    if (psStatus !== 'success') {
      return NextResponse.json({
        ok: false,
        paystackStatus: psStatus || 'pending',
        message:
          paystackData?.gateway_response ||
          'Paystack has not confirmed this payment yet',
      });
    }

    // -- success: settle the order --------------------------------------
    const totalAmount =
      Number(order.total_amount) || (paystackData.amount || 0) / 100;
    const serviceFee = Number(order.service_fee_amount) || 0;
    const netToBusiness = Math.max(0, totalAmount - serviceFee);

    // Spec: if older than a day, credit available_balance directly.
    const createdAt = new Date(order.created_at);
    const ageMs = Date.now() - createdAt.getTime();
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    const directToAvailable = ageMs > ONE_DAY_MS;

    const availableAt = directToAvailable
      ? new Date()
      : computeAvailableAt(new Date());

    // 1) Mark order paid
    await db.query(
      `UPDATE orders
          SET payment_status = 'paid',
              status = CASE WHEN status = 'pending' THEN 'confirmed' ELSE status END,
              payment_reference = $1,
              paid_at = NOW(),
              updated_at = NOW()
        WHERE id = $2`,
      [reference, order.id],
    );

    // 2) Insert transaction in correct bucket
    try {
      await db.query(
        `INSERT INTO transactions
           (id, business_id, order_id, transaction_type, amount, payment_method,
            payment_reference, status,
            settlement_status, balance_bucket, available_at, settled_at,
            created_at)
         VALUES ($1, $2, $3, 'payment', $4, 'paystack', $5, 'completed',
                 $6, $7, $8, $9, NOW())`,
        [
          `txn_${generateAlphanumericId()}`,
          order.business_id,
          order.id,
          netToBusiness,
          reference,
          directToAvailable ? 'settled' : 'pending',
          directToAvailable ? 'available' : 'pending',
          availableAt.toISOString(),
          directToAvailable ? new Date().toISOString() : null,
        ],
      );
    } catch (err) {
      console.error('[v0] recheck: transaction insert failed:', err);
    }

    // 3) Credit the right bucket on businesses
    try {
      if (directToAvailable) {
        await db.query(
          `UPDATE businesses
              SET available_balance = COALESCE(available_balance, 0) + $1,
                  total_orders = COALESCE(total_orders, 0) + 1,
                  updated_at = NOW()
            WHERE id = $2`,
          [netToBusiness, order.business_id],
        );
      } else {
        await db.query(
          `UPDATE businesses
              SET pending_balance = COALESCE(pending_balance, 0) + $1,
                  total_orders = COALESCE(total_orders, 0) + 1,
                  updated_at = NOW()
            WHERE id = $2`,
          [netToBusiness, order.business_id],
        );
      }
    } catch (err) {
      console.error('[v0] recheck: business balance update failed:', err);
    }

    // 4) Bump menu_items.order_count
    try {
      const items = await query(
        `SELECT menu_item_id, quantity FROM order_items WHERE order_id = $1`,
        [order.id],
      );
      for (const it of items || []) {
        if (!it.menu_item_id) continue;
        await db.query(
          `UPDATE menu_items
              SET order_count = COALESCE(order_count, 0) + $1,
                  updated_at = NOW()
            WHERE id = $2`,
          [Number(it.quantity) || 1, it.menu_item_id],
        );
      }
    } catch (err) {
      console.error('[v0] recheck: menu_items update failed:', err);
    }

    // 5) Admin revenue
    if (serviceFee > 0) {
      try {
        const updated = await db.query(
          `UPDATE admin_revenue
              SET total_revenue = COALESCE(total_revenue, 0) + $1,
                  available_balance = COALESCE(available_balance, 0) + $1,
                  updated_at = NOW()
            RETURNING id`,
          [serviceFee],
        );
        if (!updated || updated.length === 0) {
          await db.query(
            `INSERT INTO admin_revenue (id, total_revenue, withdrawn_amount, available_balance, updated_at)
             VALUES ($1, $2, 0, $2, NOW())`,
            [`rev_${generateAlphanumericId()}`, serviceFee],
          );
        }
      } catch (err) {
        console.error('[v0] recheck: admin_revenue update failed:', err);
      }
    }

    // 6) finance_records audit row
    try {
      await db.query(
        `INSERT INTO finance_records
           (id, business_id, record_type, bucket, direction, amount,
            related_id, reference, description, created_at)
         VALUES ($1, $2, 'recheck_credit', $3, 'in', $4, $5, $6, $7, NOW())`,
        [
          `fr_${generateAlphanumericId()}`,
          order.business_id,
          directToAvailable ? 'available' : 'pending',
          netToBusiness,
          order.id,
          reference,
          directToAvailable
            ? 'Recheck found older successful payment — credited to available'
            : 'Recheck confirmed payment — credited to pending balance',
        ],
      );
    } catch (err) {
      console.error('[v0] recheck: finance_records insert failed:', err);
    }

    return NextResponse.json({
      ok: true,
      paystackStatus: 'success',
      bucket: directToAvailable ? 'available' : 'pending',
      amount: netToBusiness,
      message: directToAvailable
        ? 'Payment confirmed and credited to available balance'
        : 'Payment confirmed and credited to pending balance',
    });
  } catch (err) {
    console.error('[v0] recheck route error:', err);
    return NextResponse.json(
      {
        error: 'Recheck failed',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}
