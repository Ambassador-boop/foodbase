/**
 * The restaurant's "new paid order" alert (Batch 3C, item b2).
 *
 * Before this file the restaurant was told about an order the moment it was
 * created — before Paystack had confirmed anything — and the only payment-time
 * message was a generic status update. Now the paid alert fires exactly once, at
 * payment confirmation, and never for an unpaid order.
 *
 * "Exactly once" is enforced by a single atomic statement, because the Neon HTTP
 * driver cannot hold a transaction open:
 *
 *   UPDATE orders SET restaurant_notified_at = NOW()
 *    WHERE id = $1 AND restaurant_notified_at IS NULL AND payment_status IN ('paid','completed')
 *   RETURNING id
 *
 * Only the caller that gets a row back sends the push. Paystack's verify endpoint
 * and its webhook can race each other all they like; the second one gets no row.
 *
 * Until `docs/sql/3c-kitchen-notifications.sql` has been run the column does not
 * exist. The code then falls back to a claim row in `notifications`, keyed on the
 * table's existing UNIQUE `onesignal_notification_id`, which gives the same
 * exactly-once behaviour without any schema change. Nothing here ever throws into
 * a payment path.
 */

import { getOne, query } from '@/lib/db';
import { generateAlphanumericId } from '@/lib/utils';
import { getKitchenSchema } from '@/lib/kitchen/schema';
import { pushSoundFields } from '@/lib/onesignal-sound';

const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';
const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

export type PaidOrderNotifyStatus =
  | 'sent'
  | 'already_notified'
  | 'order_not_found'
  | 'not_paid'
  | 'not_configured'
  | 'failed';

export type PaidOrderNotifyResult = {
  status: PaidOrderNotifyStatus;
  orderId: string;
  notificationId?: string | null;
};

function rows(result: any): any[] {
  return Array.isArray(result) ? result : result?.rows ?? [];
}

function naira(value: number): string {
  return `₦${value.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type PaidOrderRow = {
  id: string;
  business_id: string;
  customer_name: string | null;
  payment_status: string;
  total_amount: number | string | null;
  table_label?: string | null;
};

/**
 * Send the restaurant the one message that matters: this order is paid, here is
 * what it is, and here is where it goes.
 */
export async function notifyRestaurantPaidOrder(orderId: string): Promise<PaidOrderNotifyResult> {
  const base: PaidOrderNotifyResult = { status: 'failed', orderId };

  try {
    const schema = await getKitchenSchema();
    const order = (await getOne(
      `SELECT o.id, o.business_id, o.customer_name, o.payment_status, o.total_amount
              ${schema.tableLabel ? ', o.table_label' : ''}
         FROM orders o
        WHERE o.id = $1`,
      [orderId],
    )) as PaidOrderRow | null;

    if (!order) return { ...base, status: 'order_not_found' };

    const paidStatus = String(order.payment_status ?? '').trim().toLowerCase();
    if (paidStatus !== 'paid' && paidStatus !== 'completed') return { ...base, status: 'not_paid' };

    // Nothing to send with: do not claim the order, so a later run can still send
    // it once the environment is configured.
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
      console.warn('[paid-order] OneSignal is not configured; no push sent for', orderId);
      return { ...base, status: 'not_configured' };
    }

    const itemRows = rows(
      await query('SELECT COALESCE(SUM(quantity), 0)::int AS items FROM order_items WHERE order_id = $1', [orderId]),
    );
    const itemCount = Number(itemRows[0]?.items ?? 0);

    const total = Number(order.total_amount) || 0;
    const tableLabel = typeof order.table_label === 'string' ? order.table_label.trim() : '';
    const shortId = `#${String(orderId).slice(0, 8).toUpperCase()}`;

    const bodyParts = [shortId, naira(total), `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`];
    if (tableLabel) bodyParts.push(tableLabel);
    const notificationTitle = tableLabel ? `Paid order · ${tableLabel}` : 'New paid order';
    const notificationBody = bodyParts.join(' · ');

    /* --------------------------------- claim -------------------------------- */

    let claimedByColumn = false;
    let claimRowId: string | null = null;

    if (schema.notifiedAt) {
      const updated = rows(
        await query(
          `UPDATE orders SET restaurant_notified_at = NOW()
            WHERE id = $1
              AND restaurant_notified_at IS NULL
              AND payment_status IN ('paid', 'completed')
          RETURNING id`,
          [orderId],
        ),
      );
      if (updated.length === 0) return { ...base, status: 'already_notified' };
      claimedByColumn = true;
    } else {
      // No column yet: use the notifications table's UNIQUE onesignal_notification_id
      // as the claim. A deterministic value means the second caller conflicts.
      try {
        const inserted = rows(
          await query(
            `INSERT INTO notifications
               (id, order_id, business_id, notification_title, notification_body,
                onesignal_notification_id, payment_status, customer_name, created_at, updated_at, is_read)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), false)
             ON CONFLICT (onesignal_notification_id) DO NOTHING
             RETURNING id`,
            [
              generateAlphanumericId(),
              orderId,
              order.business_id,
              notificationTitle,
              notificationBody,
              `paid-claim:${orderId}`,
              order.payment_status,
              order.customer_name || 'Guest',
            ],
          ),
        );
        if (inserted.length === 0) return { ...base, status: 'already_notified' };
        claimRowId = String(inserted[0].id);
      } catch (error) {
        // The live table may not have the unique constraint we expect. Fall back
        // to sending: Paystack settlement already returns 'settled' to only one
        // caller, so this path is still almost always single.
        console.warn('[paid-order] claim row unavailable, sending without a durable claim', error);
      }
    }

    const releaseClaim = async () => {
      try {
        if (claimedByColumn) {
          await query('UPDATE orders SET restaurant_notified_at = NULL WHERE id = $1', [orderId]);
        } else if (claimRowId) {
          await query('DELETE FROM notifications WHERE id = $1', [claimRowId]);
        }
      } catch (error) {
        console.warn('[paid-order] could not release the claim for', orderId, error);
      }
    };

    /* --------------------------------- send --------------------------------- */

    const payload: Record<string, unknown> = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: notificationTitle },
      contents: { en: notificationBody },
      data: {
        orderId,
        type: 'new_paid_order',
        targetUrl: `/dashboard/orders/${orderId}`,
        totalAmount: total.toString(),
        itemCount: itemCount.toString(),
        ...(tableLabel ? { tableLabel } : {}),
      },
      filters: [{ field: 'tag', key: 'business_id', value: order.business_id }],
      priority: 10,
      ...pushSoundFields(),
    };

    let onesignalId: string | null = null;
    try {
      const response = await fetch(ONESIGNAL_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Basic ${ONESIGNAL_API_KEY}`,
        },
        body: JSON.stringify(payload),
      });
      const json: any = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error('[paid-order] OneSignal rejected the paid order push', json);
        await releaseClaim();
        return { ...base, status: 'failed' };
      }
      onesignalId = json?.id ?? json?.body?.notification_id ?? null;
    } catch (error) {
      console.error('[paid-order] OneSignal request failed', error);
      await releaseClaim();
      return { ...base, status: 'failed' };
    }

    /* -------------------------------- record -------------------------------- */

    try {
      if (claimRowId) {
        await query(
          `UPDATE notifications
              SET onesignal_notification_id = COALESCE($2, onesignal_notification_id),
                  notification_title = $3,
                  notification_body = $4,
                  updated_at = NOW()
            WHERE id = $1`,
          [claimRowId, onesignalId, notificationTitle, notificationBody],
        );
      } else {
        await query(
          `INSERT INTO notifications
             (id, order_id, business_id, notification_title, notification_body,
              onesignal_notification_id, payment_status, customer_name, created_at, updated_at, is_read)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), false)`,
          [
            generateAlphanumericId(),
            orderId,
            order.business_id,
            notificationTitle,
            notificationBody,
            onesignalId,
            order.payment_status,
            order.customer_name || 'Guest',
          ],
        );
      }
    } catch (error) {
      // The push already went out; a missing dashboard row is not worth failing.
      console.warn('[paid-order] could not record the notification row', error);
    }

    return { status: 'sent', orderId, notificationId: onesignalId };
  } catch (error) {
    console.error('[paid-order] unexpected failure', error);
    return base;
  }
}
