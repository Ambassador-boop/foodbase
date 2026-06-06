import { NextRequest, NextResponse } from 'next/server';
import { db, query, getOne } from '@/lib/db';
import { generateAlphanumericId } from '@/lib/utils';
import { computeAvailableAt } from '@/lib/wat';
import crypto from 'crypto';

/**
 * Settles an order after a successful Paystack charge. Idempotent: if the
 * order is already paid, it returns without re-applying any side effects.
 *
 * Mirrors the logic in /api/payments/verify so that whichever channel
 * (webhook or client-side verify) reports first, the data ends up in the
 * same state — pending_balance + scheduled settlement.
 */
async function settleOrder(reference: string, paystackAmount: number) {
  const order = await getOne(
    `SELECT id, business_id, total_amount, service_fee_amount, payment_status
       FROM orders
      WHERE id = $1 OR payment_reference = $1
      LIMIT 1`,
    [reference]
  );

  if (!order) {
    console.log('[v0] Webhook: No order found for reference:', reference);
    return;
  }

  if (order.payment_status === 'paid' || order.payment_status === 'completed') {
    console.log('[v0] Webhook: Order already settled:', order.id);
    return;
  }

  const totalAmount = Number(order.total_amount) || paystackAmount;
  const serviceFee = Number(order.service_fee_amount) || 0;
  const netToBusiness = Math.max(0, totalAmount - serviceFee);
  const availableAt = computeAvailableAt(new Date());

  await db.query(
    `UPDATE orders
        SET payment_status = $1,
            status = $2,
            payment_reference = $3,
            paid_at = NOW(),
            updated_at = NOW()
      WHERE id = $4`,
    ['paid', 'confirmed', reference, order.id]
  );

  try {
    await db.query(
      `INSERT INTO transactions
         (id, business_id, order_id, transaction_type, amount, payment_method, payment_reference, status,
          settlement_status, balance_bucket, available_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
      [
        `txn_${generateAlphanumericId()}`,
        order.business_id,
        order.id,
        'payment',
        netToBusiness,
        'paystack',
        reference,
        'completed',
        'pending',
        'pending',
        availableAt.toISOString(),
      ]
    );
  } catch (err) {
    console.error('[v0] Webhook: Failed to insert transaction:', err);
  }

  // Send payment completed notification to business owner
  console.log('[v0] Webhook: Triggering payment completed notification for order:', order.id);
  try {
    await fetch(
      '/api/notifications/update-order-status',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: order.id,
          status: 'confirmed',
          paymentStatus: 'paid',
        }),
      }
    );
  } catch (notificationError) {
    console.error('[v0] Webhook: Payment notification dispatch failed:', notificationError);
    // Don't fail the settlement if notification fails
  }

  try {
    await db.query(
      `UPDATE businesses
          SET pending_balance = COALESCE(pending_balance, 0) + $1,
              total_orders = COALESCE(total_orders, 0) + 1,
              updated_at = NOW()
        WHERE id = $2`,
      [netToBusiness, order.business_id]
    );
  } catch (err) {
    console.error('[v0] Webhook: Failed to update business pending_balance/total_orders:', err);
  }

  try {
    const items = await query(
      `SELECT menu_item_id, quantity FROM order_items WHERE order_id = $1`,
      [order.id]
    );
    for (const it of items || []) {
      if (!it.menu_item_id) continue;
      await db.query(
        `UPDATE menu_items
            SET order_count = COALESCE(order_count, 0) + $1,
                updated_at = NOW()
          WHERE id = $2`,
        [Number(it.quantity) || 1, it.menu_item_id]
      );
    }
  } catch (err) {
    console.error('[v0] Webhook: Failed to update menu_items.order_count:', err);
  }

  if (serviceFee > 0) {
    try {
      const updated = await db.query(
        `UPDATE admin_revenue
            SET total_revenue = COALESCE(total_revenue, 0) + $1,
                available_balance = COALESCE(available_balance, 0) + $1,
                updated_at = NOW()
          RETURNING id`,
        [serviceFee]
      );
      if (!updated || updated.length === 0) {
        await db.query(
          `INSERT INTO admin_revenue (id, total_revenue, withdrawn_amount, available_balance, updated_at)
           VALUES ($1, $2, 0, $2, NOW())`,
          [`rev_${generateAlphanumericId()}`, serviceFee]
        );
      }
    } catch (err) {
      console.error('[v0] Webhook: Failed to update admin_revenue:', err);
    }
  }

  try {
    await db.query(
      `INSERT INTO finance_records
         (id, business_id, record_type, bucket, direction, amount,
          related_id, reference, description, created_at)
       VALUES ($1, $2, 'payment_pending', 'pending', 'in', $3, $4, $5, $6, NOW())`,
      [
        `fr_${generateAlphanumericId()}`,
        order.business_id,
        netToBusiness,
        order.id,
        reference,
        `Payment received — settles ${availableAt.toISOString()}`,
      ]
    );
  } catch (err) {
    console.error('[v0] Webhook: Failed to insert finance_records:', err);
  }

  console.log('[v0] Webhook: Settlement complete', {
    orderId: order.id,
    totalAmount,
    serviceFee,
    netToBusiness,
    availableAt: availableAt.toISOString(),
  });
}

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('x-paystack-signature');
    const body = await req.text();

    console.log('[v0] Webhook received with signature:', signature);

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
      const { reference, amount } = event.data;
      console.log('[v0] Webhook: charge.success for reference:', reference);
      await settleOrder(reference, (amount || 0) / 100);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[v0] Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Handle GET — used as Paystack redirect target
export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const reference = searchParams.get('reference');
    const trxref = searchParams.get('trxref');

    console.log('[v0] Webhook GET - reference:', reference, 'trxref:', trxref);

    const paymentRef = reference || trxref;
    if (paymentRef) {
      return NextResponse.redirect(
        new URL(`/payment-success?reference=${paymentRef}`, req.url)
      );
    }

    return NextResponse.json({ error: 'No reference provided' }, { status: 400 });
  } catch (error) {
    console.error('[v0] Webhook GET error:', error);
    return NextResponse.json({ error: 'Failed to process redirect' }, { status: 500 });
  }
}
