/**
 * Reads for the kitchen display (Batch 3C).
 *
 * Two rules:
 *
 * 1. **Paid orders only.** The definition of "paid" is imported from
 *    `lib/admin-analytics.ts` (`PAID_ORDER_CONDITION`), which is the same
 *    condition `fb_settle_payment` checks and every analytics screen uses.
 *    There is no second definition in this file.
 * 2. **Cheap empty polls.** `loadKitchenSignature` returns a short string built
 *    from the row count and the newest `updated_at` on the board. The API turns
 *    it into an ETag, so a poll with nothing to say costs one aggregate query
 *    and a 304 with no body, instead of loading every ticket and its items.
 */

import { getAll, getOne } from '@/lib/db';
import { PAID_ORDER_CONDITION } from '@/lib/admin-analytics';
import { getKitchenSchema, type KitchenSchema } from './schema';
import type {
  KitchenAddon,
  KitchenBoardPayload,
  KitchenCapabilities,
  KitchenFulfilment,
  KitchenLine,
  KitchenOrder,
  KitchenStage,
  KitchenStats,
} from './types';
import { stageForStatus } from './transitions';

/** The three statuses the board shows. Everything else never appears. */
const BOARD_STATUSES = "o.status::text IN ('pending', 'preparing', 'ready')";

const WAT_OFFSET_MS = 60 * 60 * 1000;

/** Midnight in West Africa Time (UTC+1, no DST), expressed as a UTC instant. */
export function startOfWatDay(now = new Date()): Date {
  const shifted = new Date(now.getTime() + WAT_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() - WAT_OFFSET_MS);
}

export function shortOrderId(id: string): string {
  return String(id ?? '').slice(0, 8).toUpperCase();
}

function capabilitiesOf(schema: KitchenSchema): KitchenCapabilities {
  return {
    tableLabel: schema.tableLabel,
    prepMinutes: schema.prepMinutes,
    readyAt: schema.readyAt,
  };
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Add-ons live in `order_items.configuration`, exactly as the order API stores
 * them: an array of `{ id, name, price }` when add-ons were chosen, an object
 * with `item_type: 'drink'` for a plain drink, and null for a plain dish. Only
 * the name and price are read here, and a shape we do not recognise is skipped
 * rather than guessed.
 */
export function parseKitchenAddons(configuration: unknown): KitchenAddon[] {
  let value = configuration;
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  const addons: KitchenAddon[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const name = text((entry as { name?: unknown }).name);
    if (!name) continue;
    addons.push({ name, price: numberOrNull((entry as { price?: unknown }).price) });
  }
  return addons;
}

function fulfilmentOf(row: any, schema: KitchenSchema): KitchenFulfilment {
  if (schema.tableLabel && text(row.table_label)) return 'dine_in';
  if (schema.delivery && (text(row.delivery_address_text) || text(row.delivery_area_id))) return 'delivery';
  if (schema.address && text(row.address)) return 'delivery';
  return 'pickup';
}

/** The columns this database actually has; never a guess, never a failed query. */
function selectColumns(schema: KitchenSchema): string {
  return [
    schema.paidAt ? 'o.paid_at' : null,
    schema.tableLabel ? 'o.table_label' : null,
    schema.prepMinutes ? 'o.kitchen_prep_minutes' : null,
    schema.readyAt ? 'o.kitchen_ready_at' : null,
    schema.delivery ? 'o.delivery_area_id, o.delivery_address_text' : null,
    schema.address ? 'o.address' : null,
  ]
    .filter(Boolean)
    .join(', ');
}

/** `paid_at` when the settlement function wrote it, otherwise the last write. */
function paidAtExpression(schema: KitchenSchema): string {
  return schema.paidAt
    ? 'COALESCE(o.paid_at, o.updated_at, o.created_at)'
    : 'COALESCE(o.updated_at, o.created_at)';
}

function readyAtExpression(schema: KitchenSchema): string {
  return schema.readyAt ? 'o.kitchen_ready_at' : 'NULL::timestamptz';
}

/**
 * A short fingerprint of the board: how many tickets, and when the newest one
 * changed. Two different boards can only share it if they have the same size
 * and the same newest write, which cannot happen through any kitchen action.
 */
export async function loadKitchenSignature(businessId: string): Promise<string> {
  const schema = await getKitchenSchema();
  const row = await getOne(
    `SELECT count(*)::int AS total,
            COALESCE(MAX(o.updated_at), 'epoch'::timestamptz)::text AS latest,
            COALESCE(MAX(${readyAtExpression(schema)}), 'epoch'::timestamptz)::text AS latest_ready
       FROM orders o
      WHERE o.business_id = $1
        AND ${PAID_ORDER_CONDITION}
        AND ${BOARD_STATUSES}`,
    [businessId],
  );
  const total = Number(row?.total ?? 0);
  return `k1.${total}.${row?.latest ?? 'epoch'}.${row?.latest_ready ?? 'epoch'}`;
}

/**
 * Today's numbers for the strip above the board:
 *   - paid today:        orders that cleared payment since 00:00 WAT
 *   - ready today:       orders the pass marked ready since 00:00 WAT
 *   - average prep time: payment to ready, averaged over today's ready orders
 */
async function loadKitchenStats(businessId: string, schema: KitchenSchema, now: Date): Promise<KitchenStats> {
  const dayStart = startOfWatDay(now);
  const readyAt = schema.readyAt
    ? 'COALESCE(o.kitchen_ready_at, o.updated_at)'
    : 'COALESCE(o.updated_at, o.created_at)';
  const paidAt = paidAtExpression(schema);

  const row = await getOne(
    `SELECT count(*) FILTER (WHERE ${PAID_ORDER_CONDITION})::int AS paid_today,
            count(*) FILTER (WHERE o.status::text = 'ready' AND ${readyAt} >= $2)::int AS ready_today,
            avg(GREATEST(EXTRACT(EPOCH FROM (${readyAt} - ${paidAt})), 0))
              FILTER (WHERE o.status::text = 'ready' AND ${readyAt} >= $2)::float8 AS average_prep
       FROM orders o
      WHERE o.business_id = $1
        AND o.created_at >= $2`,
    [businessId, dayStart.toISOString()],
  );

  const average = numberOrNull(row?.average_prep);
  return {
    paidToday: Number(row?.paid_today ?? 0),
    readyToday: Number(row?.ready_today ?? 0),
    averagePrepSeconds: average === null ? null : Math.round(average),
    oldestOpenSeconds: null,
  };
}

/** Every ticket on the board, oldest payment first, with its lines and add-ons. */
async function loadKitchenOrders(businessId: string, schema: KitchenSchema, now: Date): Promise<KitchenOrder[]> {
  const extra = selectColumns(schema);
  const rows: any[] = await getAll(
    `SELECT o.id, o.status::text AS status, o.payment_status, o.customer_name, o.notes,
            o.total_amount, o.created_at, o.updated_at,
            ${paidAtExpression(schema)} AS paid_at,
            ${readyAtExpression(schema)} AS ready_at,
            ${schema.prepMinutes ? 'o.kitchen_prep_minutes' : 'NULL::integer'} AS prep_minutes
            ${extra ? `, ${extra}` : ''}
       FROM orders o
      WHERE o.business_id = $1
        AND ${PAID_ORDER_CONDITION}
        AND ${BOARD_STATUSES}
      ORDER BY ${paidAtExpression(schema)} ASC`,
    [businessId],
  );

  const orderRows = Array.isArray(rows) ? rows : [];
  if (orderRows.length === 0) return [];

  // One query for every ticket's lines. Placeholders are built explicitly
  // because the Neon HTTP driver does not take array parameters reliably.
  const placeholders = orderRows.map((_, index) => `$${index + 1}`).join(', ');
  let itemRows: any[] = [];
  try {
    const result: any[] = await getAll(
      `SELECT oi.id, oi.order_id, oi.quantity, oi.configuration, mi.name
         FROM order_items oi
         LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
        WHERE oi.order_id IN (${placeholders})
        ORDER BY oi.created_at ASC`,
      orderRows.map((row) => row.id),
    );
    itemRows = Array.isArray(result) ? result : [];
  } catch (error) {
    // A ticket with no lines is still a ticket: the card shows the order, the
    // kitchen can still start it, and the cook can open the order instead.
    console.warn('[kitchen] could not load order items', error);
  }

  const linesByOrder = new Map<string, KitchenLine[]>();
  for (const item of itemRows) {
    const orderId = String(item.order_id ?? '');
    if (!orderId) continue;
    const list = linesByOrder.get(orderId) ?? [];
    list.push({
      id: String(item.id ?? ''),
      name: text(item.name) ?? 'Item',
      quantity: Math.max(1, Math.round(Number(item.quantity) || 1)),
      addons: parseKitchenAddons(item.configuration),
    });
    linesByOrder.set(orderId, list);
  }

  return orderRows.map((row) => {
    const stage = (stageForStatus(row.status) ?? 'new') as KitchenStage;
    const lines = linesByOrder.get(String(row.id)) ?? [];
    const paidAtRaw = row.paid_at ?? row.updated_at ?? row.created_at ?? now.toISOString();
    const readyAtRaw = row.ready_at ?? null;
    return {
      id: String(row.id),
      shortId: shortOrderId(String(row.id)),
      stage,
      status: String(row.status ?? 'pending'),
      fulfilment: fulfilmentOf(row, schema),
      tableLabel: schema.tableLabel ? text(row.table_label) : null,
      customerName: text(row.customer_name),
      total: Number(row.total_amount) || 0,
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      notes: text(row.notes),
      items: lines,
      paidAt: new Date(paidAtRaw).toISOString(),
      readyAt: readyAtRaw ? new Date(readyAtRaw).toISOString() : null,
      prepMinutes: schema.prepMinutes ? numberOrNull(row.prep_minutes) : null,
    } satisfies KitchenOrder;
  });
}

/** The whole board, in one call. */
export async function loadKitchenBoard(
  business: { id: string; name: string },
  now = new Date(),
): Promise<KitchenBoardPayload> {
  const schema = await getKitchenSchema();
  const [orders, stats, etag] = await Promise.all([
    loadKitchenOrders(business.id, schema, now),
    loadKitchenStats(business.id, schema, now),
    loadKitchenSignature(business.id),
  ]);

  const openTickets = orders.filter((order) => order.stage !== 'ready');
  const oldest = openTickets.reduce<number>((worst, order) => {
    const seconds = Math.max(0, Math.round((now.getTime() - new Date(order.paidAt).getTime()) / 1000));
    return Math.max(worst, seconds);
  }, 0);

  return {
    success: true,
    business,
    generatedAt: now.toISOString(),
    etag,
    capabilities: capabilitiesOf(schema),
    orders,
    stats: { ...stats, oldestOpenSeconds: openTickets.length > 0 ? oldest : null },
  };
}

export type KitchenOrderGuard = {
  id: string;
  business_id: string;
  status: string;
  payment_status: string;
};

/** The single order a transition is about to touch, scoped to the business. */
export async function loadKitchenOrderGuard(
  businessId: string,
  orderId: string,
): Promise<KitchenOrderGuard | null> {
  const row = await getOne(
    `SELECT o.id, o.business_id, o.status::text AS status, o.payment_status
       FROM orders o
      WHERE o.id = $1 AND o.business_id = $2`,
    [orderId, businessId],
  );
  if (!row) return null;
  return {
    id: String(row.id),
    business_id: String(row.business_id),
    status: String(row.status ?? 'pending'),
    payment_status: String(row.payment_status ?? ''),
  };
}
