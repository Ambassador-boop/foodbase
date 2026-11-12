/**
 * Storage for delivery areas and table labels (Batch 3B).
 *
 * Two rules shape this file:
 *
 * 1. **The SQL is run by the owner, not the app.** The dashboard and the order
 *    API must behave exactly like today until `docs/sql/batch-3b-delivery.sql`
 *    has been applied. Everything therefore goes through `getSchemaSupport()`,
 *    which asks Postgres what exists and caches the answer for the process.
 *
 * 2. **A read must never break an order.** Every loader catches its own errors
 *    and returns an empty result, so a missing table, a permissions problem or a
 *    timeout degrades to "no areas configured" instead of a 500 at payment.
 */

import { getAll, getOne } from '@/lib/db';
import type { DeliveryArea, TableLabel } from '@/lib/delivery/types';

export type SchemaSupport = {
  /** `delivery_areas` exists. */
  deliveryAreas: boolean;
  /** `table_labels` exists. */
  tableLabels: boolean;
  /** `businesses.prep_time_minutes` exists. */
  prepTime: boolean;
  /** `businesses.latitude` and `businesses.longitude` exist. */
  businessGeo: boolean;
  /** `orders.delivery_fee` and friends exist. */
  orderDelivery: boolean;
  /** `orders.table_label` exists. */
  orderTableLabel: boolean;
};

const NO_SCHEMA: SchemaSupport = {
  deliveryAreas: false,
  tableLabels: false,
  prepTime: false,
  businessGeo: false,
  orderDelivery: false,
  orderTableLabel: false,
};

let cached: SchemaSupport | null = null;
let inflight: Promise<SchemaSupport> | null = null;

async function detect(): Promise<SchemaSupport> {
  try {
    const tableRows = await getAll(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('delivery_areas', 'table_labels')`,
      [],
    );
    const tables = new Set(
      (Array.isArray(tableRows) ? tableRows : []).map((row: any) => String(row.table_name)),
    );

    const orderColumns = await getAll(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'orders'`,
      [],
    );
    const orderCols = new Set(
      (Array.isArray(orderColumns) ? orderColumns : []).map((row: any) => String(row.column_name)),
    );

    const businessColumns = await getAll(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'businesses'`,
      [],
    );
    const businessCols = new Set(
      (Array.isArray(businessColumns) ? businessColumns : []).map((row: any) => String(row.column_name)),
    );

    return {
      deliveryAreas: tables.has('delivery_areas'),
      tableLabels: tables.has('table_labels'),
      prepTime: businessCols.has('prep_time_minutes'),
      businessGeo: businessCols.has('latitude') && businessCols.has('longitude'),
      orderDelivery:
        orderCols.has('delivery_fee') &&
        orderCols.has('delivery_area_id') &&
        orderCols.has('delivery_lat') &&
        orderCols.has('delivery_lng'),
      orderTableLabel: orderCols.has('table_label'),
    };
  } catch (error) {
    // Information schema unavailable (rare, restrictive role). Assume nothing is
    // migrated: the product then behaves exactly as it did before this batch.
    console.warn('[delivery] schema detection failed, assuming pre-3B schema', error);
    return NO_SCHEMA;
  }
}

export async function getSchemaSupport(): Promise<SchemaSupport> {
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

/** Test seam: lets a script verify both worlds without restarting a server. */
export function __setSchemaSupportForTests(support: SchemaSupport | null) {
  cached = support;
}

function numberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normaliseGeometry(value: unknown): DeliveryArea['polygon'] {
  if (!value) return null;
  let parsed = value;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const candidate = parsed as { type?: unknown; coordinates?: unknown };
  if (candidate.type !== 'Polygon' && candidate.type !== 'MultiPolygon') return null;
  if (!Array.isArray(candidate.coordinates)) return null;
  return { type: candidate.type, coordinates: candidate.coordinates };
}

export function normaliseAreaRow(row: any): DeliveryArea {
  return {
    id: String(row.id),
    business_id: String(row.business_id),
    name: String(row.name ?? ''),
    area_type: (row.area_type ?? 'flat') as DeliveryArea['area_type'],
    fee: Number(row.fee) || 0,
    min_order: numberOrNull(row.min_order),
    free_delivery_threshold: numberOrNull(row.free_delivery_threshold),
    is_active: row.is_active !== false,
    priority: Number(row.priority) || 0,
    center_lat: numberOrNull(row.center_lat),
    center_lng: numberOrNull(row.center_lng),
    radius_m: numberOrNull(row.radius_m),
    polygon: normaliseGeometry(row.polygon),
    isochrone_minutes: numberOrNull(row.isochrone_minutes),
    isochrone_profile: typeof row.isochrone_profile === 'string' ? row.isochrone_profile : null,
    isochrone_geometry: normaliseGeometry(row.isochrone_geometry),
    area_sqm: numberOrNull(row.area_sqm),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

/** Every area for a business, active or not, ordered for a stable list view. */
export async function loadAreas(businessId: string): Promise<DeliveryArea[]> {
  const support = await getSchemaSupport();
  if (!support.deliveryAreas) return [];
  try {
    const rows = await getAll(
      `SELECT * FROM delivery_areas WHERE business_id = $1
        ORDER BY is_active DESC, priority ASC, created_at ASC`,
      [businessId],
    );
    return (Array.isArray(rows) ? rows : []).map(normaliseAreaRow);
  } catch (error) {
    console.warn('[delivery] could not load areas', error);
    return [];
  }
}

/** Only the areas that can take an order today. */
export async function loadActiveAreas(businessId: string): Promise<DeliveryArea[]> {
  const areas = await loadAreas(businessId);
  return areas.filter((area) => area.is_active);
}

export async function loadArea(businessId: string, areaId: string): Promise<DeliveryArea | null> {
  const support = await getSchemaSupport();
  if (!support.deliveryAreas) return null;
  try {
    const row = await getOne(
      'SELECT * FROM delivery_areas WHERE id = $1 AND business_id = $2',
      [areaId, businessId],
    );
    return row ? normaliseAreaRow(row) : null;
  } catch (error) {
    console.warn('[delivery] could not load area', error);
    return null;
  }
}

export function normaliseLabelRow(row: any): TableLabel {
  return {
    id: String(row.id),
    business_id: String(row.business_id),
    label: String(row.label ?? ''),
    sort_order: Number(row.sort_order) || 0,
    is_active: row.is_active !== false,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export async function loadTableLabels(businessId: string): Promise<TableLabel[]> {
  const support = await getSchemaSupport();
  if (!support.tableLabels) return [];
  try {
    const rows = await getAll(
      `SELECT * FROM table_labels WHERE business_id = $1
        ORDER BY sort_order ASC, created_at ASC`,
      [businessId],
    );
    return (Array.isArray(rows) ? rows : []).map(normaliseLabelRow);
  } catch (error) {
    console.warn('[delivery] could not load table labels', error);
    return [];
  }
}

/** Prep time in minutes, or null when the owner has never set one. */
export async function loadPrepTimeMinutes(businessId: string): Promise<number | null> {
  const support = await getSchemaSupport();
  if (!support.prepTime) return null;
  try {
    const row = await getOne(
      'SELECT prep_time_minutes FROM businesses WHERE id = $1',
      [businessId],
    );
    return numberOrNull(row?.prep_time_minutes);
  } catch (error) {
    console.warn('[delivery] could not load prep time', error);
    return null;
  }
}

export type BusinessLocation = {
  lat: number;
  lng: number;
};

/**
 * The restaurant's own pin, used as the origin for drive-time estimates and as
 * the default centre of the area editor. Null until the owner places it.
 */
export async function loadBusinessLocation(businessId: string): Promise<BusinessLocation | null> {
  const support = await getSchemaSupport();
  if (!support.businessGeo) return null;
  try {
    const row = await getOne(
      'SELECT latitude, longitude FROM businesses WHERE id = $1',
      [businessId],
    );
    const lat = numberOrNull(row?.latitude);
    const lng = numberOrNull(row?.longitude);
    if (lat === null || lng === null) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
  } catch (error) {
    console.warn('[delivery] could not load business location', error);
    return null;
  }
}

/**
 * A label counts as configured only when it is active AND still exists, so
 * disabling every label returns dine-in to today's behaviour immediately.
 */
export function activeLabels(labels: TableLabel[]): TableLabel[] {
  return labels.filter((label) => label.is_active && label.label.trim().length > 0);
}
