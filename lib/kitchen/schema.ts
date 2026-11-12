/**
 * Column detection for the kitchen display (Batch 3C).
 *
 * Same rule as Batch 3B: the SQL in `docs/sql/3c-kitchen-notifications.sql` is
 * run by the owner, not by the app, so every 3C column is optional at runtime.
 * This module asks Postgres once what exists and caches the answer for the
 * process; nothing here writes, migrates or assumes.
 *
 * A missing column must never break a screen or a payment: the board falls back
 * to `created_at` for elapsed time, hides the prep estimate, and the paid-order
 * notification falls back to a claim row in `notifications`.
 */

import { getAll } from '@/lib/db';

export type KitchenSchema = {
  /** `orders.paid_at` — set by fb_settle_payment. Elapsed time prefers it. */
  paidAt: boolean;
  /** `orders.table_label` — Batch 3B. */
  tableLabel: boolean;
  /** `orders.delivery_area_id` and friends — Batch 3B. */
  delivery: boolean;
  /** `orders.address` — the pre-3B delivery address. */
  address: boolean;
  /** `orders.restaurant_notified_at` — Batch 3C, the paid-order idempotency marker. */
  notifiedAt: boolean;
  /** `orders.kitchen_prep_minutes` — Batch 3C, the per-ticket prep estimate. */
  prepMinutes: boolean;
  /** `orders.kitchen_ready_at` — Batch 3C, when the pass marked it ready. */
  readyAt: boolean;
};

const NO_COLUMNS: KitchenSchema = {
  paidAt: false,
  tableLabel: false,
  delivery: false,
  address: false,
  notifiedAt: false,
  prepMinutes: false,
  readyAt: false,
};

let cached: KitchenSchema | null = null;
let inflight: Promise<KitchenSchema> | null = null;

async function detect(): Promise<KitchenSchema> {
  try {
    const rows = await getAll(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders'`,
      [],
    );
    const columns = new Set(
      (Array.isArray(rows) ? rows : []).map((row: any) => String(row.column_name)),
    );
    return {
      paidAt: columns.has('paid_at'),
      tableLabel: columns.has('table_label'),
      delivery: columns.has('delivery_area_id') && columns.has('delivery_address_text'),
      address: columns.has('address'),
      notifiedAt: columns.has('restaurant_notified_at'),
      prepMinutes: columns.has('kitchen_prep_minutes'),
      readyAt: columns.has('kitchen_ready_at'),
    };
  } catch (error) {
    console.warn('[kitchen] could not read orders columns, using the safe defaults', error);
    return NO_COLUMNS;
  }
}

export async function getKitchenSchema(): Promise<KitchenSchema> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = detect()
    .then((support) => {
      cached = support;
      return support;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Test seam: lets a script check both worlds without restarting a server. */
export function __setKitchenSchemaForTests(support: KitchenSchema | null) {
  cached = support;
}
