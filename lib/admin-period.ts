/**
 * Date-range helpers for the admin analytics screens.
 *
 * Every range is expressed as a half-open UTC interval whose boundaries fall on
 * midnight in West Africa Time (UTC+1, no DST), so "today" starts at 00:00 WAT,
 * not 00:00 UTC and not 24 rolling hours.
 */

export const ADMIN_TIME_ZONE = 'Africa/Lagos'

const WAT_OFFSET_MS = 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export type AdminRangeKey = 'today' | '7d' | '30d' | 'month' | 'all' | 'custom'

export interface AdminPeriod {
  key: AdminRangeKey
  /** Inclusive start, or null for "all time". */
  start: Date | null
  /** Exclusive end. */
  end: Date
  /** Same-length window immediately before `start`, or null for "all time". */
  previousStart: Date | null
  previousEnd: Date | null
  /** Number of whole days covered, or null for "all time". */
  days: number | null
  label: string
}

export const RANGE_KEYS: AdminRangeKey[] = ['today', '7d', '30d', 'month', 'all']

interface WallClock {
  year: number
  month: number
  day: number
}

function wallClock(date: Date): WallClock {
  const shifted = new Date(date.getTime() + WAT_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  }
}

/** UTC instant of 00:00 WAT on the given WAT calendar day. */
function watMidnight(parts: WallClock): Date {
  return new Date(Date.UTC(parts.year, parts.month, parts.day) - WAT_OFFSET_MS)
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS)
}

function startOfWatDay(date: Date): Date {
  return watMidnight(wallClock(date))
}

function parseYmd(value: string | null): WallClock | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2]) - 1
  const day = Number(match[3])
  const probe = new Date(Date.UTC(year, month, day))
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month || probe.getUTCDate() !== day) {
    return null
  }
  return { year, month, day }
}

const shortDate = new Intl.DateTimeFormat('en-NG', {
  timeZone: ADMIN_TIME_ZONE,
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

function rangeLabel(key: AdminRangeKey, start: Date | null, end: Date): string {
  if (key === 'today') return 'Today'
  if (key === '7d') return 'Last 7 days'
  if (key === '30d') return 'Last 30 days'
  if (key === 'month') return 'This month'
  if (key === 'all') return 'All time'
  if (!start) return 'Custom range'
  const lastDay = new Date(end.getTime() - 1)
  return `${shortDate.format(start)} – ${shortDate.format(lastDay)}`
}

export interface ResolvePeriodOptions {
  range?: string | null
  from?: string | null
  to?: string | null
  now?: Date
}

/**
 * Resolves the `range`, `from` and `to` query parameters into a period.
 * Unknown ranges fall back to the last 30 days.
 */
export function resolveAdminPeriod(options: ResolvePeriodOptions = {}): AdminPeriod {
  const now = options.now ?? new Date()
  const requested = (options.range ?? '30d') as AdminRangeKey
  const todayStart = startOfWatDay(now)

  if (requested === 'custom') {
    const from = parseYmd(options.from ?? null)
    const to = parseYmd(options.to ?? null)
    if (from && to) {
      const start = watMidnight(from)
      const end = addDays(watMidnight(to), 1)
      if (end.getTime() > start.getTime()) {
        const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS))
        return {
          key: 'custom',
          start,
          end,
          previousStart: addDays(start, -days),
          previousEnd: start,
          days,
          label: rangeLabel('custom', start, end),
        }
      }
    }
    return buildRange('30d', todayStart, now)
  }

  if (requested === 'all') {
    return {
      key: 'all',
      start: null,
      end: now,
      previousStart: null,
      previousEnd: null,
      days: null,
      label: 'All time',
    }
  }

  if (requested === 'month') {
    const wall = wallClock(now)
    const start = watMidnight({ year: wall.year, month: wall.month, day: 1 })
    return buildRange('month', start, now)
  }

  if (requested === 'today') {
    return buildRange('today', todayStart, now)
  }

  if (requested === '7d') {
    return buildRange('7d', addDays(todayStart, -6), now)
  }

  return buildRange('30d', addDays(todayStart, -29), now)
}

function buildRange(key: AdminRangeKey, start: Date, end: Date): AdminPeriod {
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY_MS))
  return {
    key,
    start,
    end,
    previousStart: addDays(start, -days),
    previousEnd: start,
    days,
    label: rangeLabel(key, start, end),
  }
}

/** Serialisable description of a period for API responses. */
export interface SerialisedPeriod {
  key: AdminRangeKey
  start: string | null
  end: string
  previousStart: string | null
  previousEnd: string | null
  days: number | null
  label: string
}

export function serialisePeriod(period: AdminPeriod): SerialisedPeriod {
  return {
    key: period.key,
    start: period.start ? period.start.toISOString() : null,
    end: period.end.toISOString(),
    previousStart: period.previousStart ? period.previousStart.toISOString() : null,
    previousEnd: period.previousEnd ? period.previousEnd.toISOString() : null,
    days: period.days,
    label: period.label,
  }
}

/** SQL parameters shared by every range-filtered query: [startIso, endIso]. */
export function periodSqlParams(period: AdminPeriod): [string | null, string] {
  return [period.start ? period.start.toISOString() : null, period.end.toISOString()]
}

/**
 * Next run of the settlement cron. vercel.json schedules /api/cron/settle-balances
 * at 04:00 UTC every day, which is 05:00 in West Africa Time.
 */
export function nextSettlementRun(now = new Date()): Date {
  const wall = wallClock(now)
  const today = new Date(Date.UTC(wall.year, wall.month, wall.day, 5) - WAT_OFFSET_MS)
  if (today.getTime() > now.getTime()) return today
  return new Date(Date.UTC(wall.year, wall.month, wall.day + 1, 5) - WAT_OFFSET_MS)
}

