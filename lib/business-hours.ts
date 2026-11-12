import { getAll, getOne, query } from '@/lib/db'
import { generateId } from '@/lib/utils-extended'
import {
  AVAILABILITY_KEYS,
  DEFAULT_HOURS,
  WEEK_ORDER,
  evaluateOrdering,
  lagosNow,
  toHm,
  type DayHours,
  type HoursState,
} from '@/lib/hours-shared'

/**
 * Opening hours, server side.
 *
 * Source of truth is the additive `business_hours` table (one row per weekday).
 * `businesses.availability` (JSONB) predates this batch and is what the current
 * storefront info panel reads, so every save mirrors into it as well. Nothing
 * about that column's shape changes: { schedule: { mon: { open, close, closed } }, note }.
 *
 * Pure helpers live in `lib/hours-shared.ts` so screens can use them.
 */

export {
  DAY_LABELS,
  WEEK_ORDER,
  toHm,
  isOpenAt,
  describeToday,
  lagosNow,
  nextOpeningAt,
  hasConfiguredHours,
  isOrderingPaused,
  evaluateOrdering,
  formatTime12h,
  type DayHours,
  type HoursState,
  type StorefrontHours,
} from '@/lib/hours-shared'

function rowsOf<T>(raw: any): T[] {
  return Array.isArray(raw) ? raw : (raw?.rows ?? [])
}

export async function getBusinessHours(businessId: string): Promise<HoursState> {
  let acceptOrdersOutsideHours = true
  try {
    const row = await getOne(
      'SELECT accept_orders_outside_hours FROM businesses WHERE id = $1 LIMIT 1',
      [businessId],
    )
    if (row && typeof (row as Record<string, unknown>).accept_orders_outside_hours === 'boolean') {
      acceptOrdersOutsideHours = Boolean((row as Record<string, unknown>).accept_orders_outside_hours)
    }
  } catch {
    // Column not migrated yet: default (orders accepted outside hours) stands.
  }

  try {
    const rows = await getAll(
      'SELECT day_of_week, is_closed, open_time, close_time FROM business_hours WHERE business_id = $1',
      [businessId],
    )
    const list = rowsOf<Record<string, unknown>>(rows)
    if (list.length > 0) {
      const byDay = new Map<number, DayHours>()
      for (const row of list) {
        const day = Number(row.day_of_week)
        byDay.set(day, {
          day_of_week: day,
          is_closed: Boolean(row.is_closed),
          open_time: toHm(row.open_time),
          close_time: toHm(row.close_time),
        })
      }
      return {
        days: WEEK_ORDER.map((day) => byDay.get(day) ?? { ...DEFAULT_HOURS.find((d) => d.day_of_week === day)! }),
        acceptOrdersOutsideHours,
        source: 'table',
        tableReady: true,
      }
    }
  } catch {
    // Table absent. Fall through to the legacy JSON below.
  }

  // Legacy: read whatever the old availability panel already had.
  try {
    const row = await getOne('SELECT availability FROM businesses WHERE id = $1 LIMIT 1', [businessId])
    const availability = row ? (row as Record<string, any>).availability : null
    const schedule = availability && typeof availability === 'object' ? availability.schedule : null
    if (schedule && typeof schedule === 'object') {
      const days = WEEK_ORDER.map((day) => {
        const entry = schedule[AVAILABILITY_KEYS[day]]
        if (!entry || entry.closed === true) {
          return { day_of_week: day, is_closed: true, open_time: null, close_time: null }
        }
        return {
          day_of_week: day,
          is_closed: false,
          open_time: toHm(entry.open),
          close_time: toHm(entry.close),
        }
      })
      return { days, acceptOrdersOutsideHours, source: 'availability', tableReady: false }
    }
  } catch {
    // ignore
  }

  return { days: DEFAULT_HOURS.map((day) => ({ ...day })), acceptOrdersOutsideHours, source: 'empty', tableReady: false }
}

/** Builds the legacy JSON shape so the existing storefront panel keeps working. */
export function toAvailability(days: DayHours[], note?: string | null) {
  const schedule: Record<string, { open: string; close: string; closed: boolean }> = {}
  for (const day of days) {
    schedule[AVAILABILITY_KEYS[day.day_of_week]] = day.is_closed || !day.open_time || !day.close_time
      ? { open: '', close: '', closed: true }
      : { open: day.open_time, close: day.close_time, closed: false }
  }
  return { schedule, ...(note ? { note } : {}) }
}

export async function saveBusinessHours(
  businessId: string,
  days: DayHours[],
  acceptOrdersOutsideHours: boolean,
): Promise<{ tableSaved: boolean }> {
  let tableSaved = false

  if (days.length === 7) {
    try {
      for (const day of days) {
        await query(
          `INSERT INTO business_hours (id, business_id, day_of_week, is_closed, open_time, close_time, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW())
           ON CONFLICT (business_id, day_of_week)
           DO UPDATE SET is_closed = EXCLUDED.is_closed,
                         open_time = EXCLUDED.open_time,
                         close_time = EXCLUDED.close_time,
                         updated_at = NOW()`,
          [
            generateId('bh'),
            businessId,
            day.day_of_week,
            day.is_closed,
            day.is_closed ? null : day.open_time,
            day.is_closed ? null : day.close_time,
          ],
        )
      }
      tableSaved = true
    } catch (error) {
      console.warn('[hours] business_hours not writable', error)
    }
  }

  // Mirror into the JSONB so the current storefront panel reflects the change
  // immediately, whether or not the additive table exists yet.
  try {
    await query('UPDATE businesses SET availability = $1, updated_at = NOW() WHERE id = $2', [
      JSON.stringify(toAvailability(days)),
      businessId,
    ])
  } catch (error) {
    console.warn('[hours] availability mirror failed', error)
  }

  try {
    await query('UPDATE businesses SET accept_orders_outside_hours = $1 WHERE id = $2', [
      acceptOrdersOutsideHours,
      businessId,
    ])
  } catch {
    // Column not migrated: nothing to persist, and behaviour stays "accept".
  }

  return { tableSaved }
}

/* ==========================================================================
 * Batch 3A-fix: the ordering gate
 * ========================================================================== */

export type OrderingStatus = {
  /** False only when an order must be refused right now. */
  allowed: boolean
  openNow: boolean
  /** False when the owner has no schedule yet. */
  hoursConfigured: boolean
  /** "Opens today at 10:00 AM", or null when open / unknown. */
  opensAt: string | null
}

/**
 * Can this business take an order right now?
 *
 * Refuses only when every one of these is true: the owner turned
 * accept_orders_outside_hours off, a schedule exists, and Lagos wall-clock time
 * is currently outside it. A missing column, a missing table, a failed query or
 * an empty schedule all resolve to "allowed" - an order is never lost because
 * the hours lookup could not answer.
 */
export async function getOrderingStatus(businessId: string): Promise<OrderingStatus> {
  const allow: OrderingStatus = {
    allowed: true,
    openNow: true,
    hoursConfigured: false,
    opensAt: null,
  }

  try {
    const state = await getBusinessHours(businessId)
    return evaluateOrdering(state.days, state.acceptOrdersOutsideHours, lagosNow())
  } catch (error) {
    console.warn('[hours] ordering status unavailable, allowing the order', error)
    return allow
  }
}
