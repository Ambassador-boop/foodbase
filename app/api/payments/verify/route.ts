import { NextRequest, NextResponse } from 'next/server';
import { verifyPayment } from '@/lib/paystack';
import { db, query, getOne } from '@/lib/db';
import { generateAlphanumericId } from '@/lib/utils';
import { computeAvailableAt } from '@/lib/wat';
import { sendOrderStatusNotification } from '@/lib/notification-service';

/**
 * Verifies a Paystack payment, then atomically settles the order:
 *  - Marks the order paid / confirmed.
 *  - Records a transaction with the NET amount routed to the business
 *    (total minus service fee — the service fee is admin revenue).
 *  - Credits businesses.PENDING_balance (NOT available_balance). The daily
 *    05:00 WAT cron at /api/cron/settle-balances moves it to available
 *    once it's due (Mon-Thu next day, Fri/Sat/Sun -> Monday).
 *  - Increments businesses.total_orders by 1.
 *  - Increments menu_items.order_count by ordered quantity for each item.
 *  - Credits admin_revenue with the service fee.
 *  - Writes a finance_records row of type 'payment_pending'.
 *
 * Idempotent: re-verifying an already paid order will not double-count.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reference } = body;

    if (!reference) {
      return NextResponse.json({ error: 'Reference is required' }, { status: 400 });
    }

    console.log('[v0] Verify: Verifying Paystack reference:', reference);

    const paystackResponse = await verifyPayment(reference);

    if (!paystackResponse?.status || paystackResponse.data?.status !== 'success') {
      console.log('[v0] Verify: Paystack reports unsuccessful payment:', paystackResponse?.data?.status);
      return NextResponse.json(
        { error: 'Payment was not successful', status: paystackResponse?.data?.status },
        { status: 400 }
      );
    }

    const paymentData = paystackResponse.data;
    const paystackAmount = (paymentData.amount || 0) / 100; // kobo -> NGN
    const metadataOrderId = paymentData.metadata?.orderId;

    // Locate the order. Try metadata first, then reference == id, then payment_reference.
    const order = await getOne(
      `SELECT id, business_id, total_amount, service_fee_amount, payment_status, customer_name
         FROM orders
        WHERE id = $1 OR id = $2 OR payment_reference = $1
        LIMIT 1`,
      [reference, metadataOrderId || '']
    );

    if (!order) {
      console.log('[v0] Verify: No order found for reference:', reference);
      return NextResponse.json({ error: 'Order not found for this reference' }, { status: 404 });
    }

    // Pull the business slug for the redirect, regardless of payment state
    const business = await getOne(
      `SELECT slug FROM businesses WHERE id = $1`,
      [order.business_id]
    );
    const businessSlug = business?.slug || '';

    // Idempotency: already settled
    if (order.payment_status === 'paid' || order.payment_status === 'completed') {
      console.log('[v0] Verify: Order already settled:', order.id);
      return NextResponse.json({
        success: true,
        status: 'success',
        amount: Number(order.total_amount) || paystackAmount,
        reference,
        orderId: order.id,
        businessSlug,
        message: 'Order already settled',
        alreadySettled: true,
      });
    }

    const totalAmount = Number(order.total_amount) || paystackAmount;
    const serviceFee = Number(order.service_fee_amount) || 0;
    const netToBusiness = Math.max(0, totalAmount - serviceFee);

    const paidAt = new Date();
    const availableAt = computeAvailableAt(paidAt);

    // 1) Mark order paid + confirmed
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
    console.log('[v0] Verify: Order marked paid:', order.id);

    // 2) Insert transaction (net to business) — sits in `pending` bucket
    //    until the daily settlement cron moves it.
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
      console.error('[v0] Verify: Failed to insert transaction:', err);
    }

    // 3) Credit business PENDING balance + bump total_orders
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
      console.error('[v0] Verify: Failed to update business pending_balance/total_orders:', err);
    }

    // 4) Increment menu_items.order_count for each item
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
      console.error('[v0] Verify: Failed to update menu_items.order_count:', err);
    }

    // 5) Credit admin_revenue with the service fee
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
        console.error('[v0] Verify: Failed to update admin_revenue:', err);
      }
    }

    // 6) Append a finance_records audit entry (powers /dashboard/finance Records)
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
      console.error('[v0] Verify: Failed to insert finance_records:', err);
    }

    // 7) Send status update notification about payment completion
    console.log('[v0] Verify: Triggering payment completed notification');
    try {
      const notificationSent = await sendOrderStatusNotification(order.id, 'confirmed', 'paid');
      if (notificationSent) {
        console.log('[v0] Verify: Payment notification sent successfully');
      } else {
        console.warn('[v0] Verify: Payment notification failed, but continuing with payment verification');
      }
    } catch (notificationError) {
      console.error('[v0] Verify: Status update notification dispatch failed:', notificationError);
      // Don't fail payment verification if notification fails
    }

    console.log('[v0] Verify: Settlement complete', {
      orderId: order.id,
      totalAmount,
      serviceFee,
      netToBusiness,
      availableAt: availableAt.toISOString(),
    });

    return NextResponse.json({
      success: true,
      status: 'success',
      amount: totalAmount,
      reference,
      orderId: order.id,
      businessSlug,
      message: 'Payment verified successfully',
    });
  } catch (error) {
    console.error('[v0] Verify: Error verifying payment:', error);
    return NextResponse.json(
      {
        error: 'Failed to verify payment',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
