/**
 * Pure opening-hours helpers.
 *
 * Deliberately separate from `lib/business-hours.ts`: that module talks to the
 * database and must never be imported by a client component. Anything a screen
 * needs to render or validate lives here instead.
 */

export type DayHours = {
  day_of_week: number // 0 = Sunday … 6 = Saturday
  is_closed: boolean
  open_time: string | null // "HH:MM"
  close_time: string | null
}


export type HoursState = {
  days: DayHours[]
  acceptOrdersOutsideHours: boolean
  /** Where the values came from, so the UI can be honest about legacy data. */
  source: 'table' | 'availability' | 'empty'
  /** False when the additive table is missing; saves then fall back to JSON only. */
  tableReady: boolean
}

export const DAY_LABELS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

/** Order used on screen: Monday first, as people read a rota. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

export const AVAILABILITY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

const DEFAULT_HOURS: DayHours[] = WEEK_ORDER.map((day) => ({
  day_of_week: day,
  is_closed: true,
  open_time: null,
  close_time: null,
}))

/** Postgres TIME comes back as "HH:MM:SS"; the UI and the mirror want "HH:MM". */
export function toHm(value: unknown): string | null {
  if (!value) return null
  const text = String(value)
  const match = text.match(/^(\d{2}):(\d{2})/)
  return match ? `${match[1]}:${match[2]}` : null
}

/** True when `now` falls inside the window for that weekday, including past-midnight ranges. */
export function isOpenAt(days: DayHours[], now: Date): boolean {
  const minutes = now.getHours() * 60 + now.getMinutes()
  const today = now.getDay()
  const todayRow = days.find((day) => day.day_of_week === today)
  const yesterdayRow = days.find((day) => day.day_of_week === (today + 6) % 7)

  const toMinutes = (value: string | null) => {
    if (!value) return null
    const [h, m] = value.split(':')
    const hours = Number(h)
    if (!Number.isFinite(hours)) return null
    return hours * 60 + Number(m ?? 0)
  }

  const todayOpen = todayRow && !todayRow.is_closed ? toMinutes(todayRow.open_time) : null
  const todayClose = todayRow && !todayRow.is_closed ? toMinutes(todayRow.close_time) : null

  if (todayOpen !== null && todayClose !== null) {
    // Same-day window.
    if (todayClose > todayOpen && minutes >= todayOpen && minutes < todayClose) return true
    // Past-midnight window: open 18:00, close 02:00 means the morning tail belongs
    // to yesterday's row, handled below.
    if (todayClose <= todayOpen && minutes >= todayOpen) return true
  }

  if (yesterdayRow && !yesterdayRow.is_closed) {
    const yOpen = toMinutes(yesterdayRow.open_time)
    const yClose = toMinutes(yesterdayRow.close_time)
    if (yOpen !== null && yClose !== null && yClose <= yOpen && minutes < yClose) return true
  }

  return false
}

/** Short human summary used by the storefront and the dashboard card. */
export function describeToday(days: DayHours[], now: Date): string {
  const row = days.find((day) => day.day_of_week === now.getDay())
  if (!row || row.is_closed || !row.open_time || !row.close_time) return 'Closed today'
  return `${row.open_time} – ${row.close_time}`
}


export { DEFAULT_HOURS }

/* ==========================================================================
 * Batch 3A-fix: enforcing "accept orders outside hours"
 *
 * Additive only. Everything above is unchanged; the helpers below are what the
 * order API, the cart/checkout screens and the hours editor use to agree on one
 * answer to "can this restaurant take an order right now?".
 * ========================================================================== */

/** Lagos is UTC+1 all year round, so a fixed offset is exact. */
const LAGOS_OFFSET_MINUTES = 60

/**
 * A Date whose local getters (`getHours`, `getDay`, …) read as Africa/Lagos
 * wall-clock time, whatever timezone the runtime happens to be in.
 *
 * Vercel runs in UTC, so `new Date()` there is an hour behind Lagos and would
 * open and close the restaurant at the wrong time. This shifts the instant
 * without touching the real timestamp.
 */
export function lagosNow(base: Date = new Date()): Date {
  return new Date(base.getTime() + base.getTimezoneOffset() * 60000 + LAGOS_OFFSET_MINUTES * 60000)
}

function minutesOfDay(value: string | null): number | null {
  if (!value) return null
  const [hour, minute] = value.split(':')
  const hours = Number(hour)
  if (!Number.isFinite(hours)) return null
  const mins = Number(minute ?? 0)
  return hours * 60 + (Number.isFinite(mins) ? mins : 0)
}

/** "18:30" -> "6:30 PM". Used for the "opens at" copy, never for stored values. */
export function formatTime12h(value: string | null): string {
  const total = minutesOfDay(value)
  if (total === null) return ''
  const hours24 = Math.floor(total / 60) % 24
  const minutes = total % 60
  const suffix = hours24 >= 12 ? 'PM' : 'AM'
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12
  return `${hours12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

/**
 * True when the owner has actually set a window: at least one day open with
 * both times. Everything that must "never block on missing data" keys off this.
 */
export function hasConfiguredHours(days: DayHours[] | null | undefined): boolean {
  if (!Array.isArray(days)) return false
  return days.some((day) => !day.is_closed && Boolean(day.open_time) && Boolean(day.close_time))
}

export type NextOpening = {
  /** "Opens today at 10:00 AM" */
  label: string
  /** 0 = today, 1 = tomorrow, … */
  dayOffset: number
  /** "HH:MM" */
  openTime: string
  minutesUntil: number
}

/**
 * The next time this restaurant opens, from `now` (pass a Lagos-shifted Date).
 *
 * Returns null when no hours are configured at all, which callers must read as
 * "unknown", never as "closed forever".
 */
export function nextOpeningAt(days: DayHours[], now: Date): NextOpening | null {
  if (!Array.isArray(days) || days.length === 0) return null
  if (!hasConfiguredHours(days)) return null

  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  for (let offset = 0; offset <= 7; offset += 1) {
    const weekday = (now.getDay() + offset) % 7
    const row = days.find((day) => day.day_of_week === weekday)
    if (!row || row.is_closed || !row.open_time || !row.close_time) continue

    const open = minutesOfDay(row.open_time)
    if (open === null) continue
    // Today's window has already started. If it is a past-midnight window it is
    // also still open, and isOpenAt would have said so; otherwise today is done.
    if (offset === 0 && open <= nowMinutes) continue

    const dayLabel =
      offset === 0 ? 'today' : offset === 1 ? 'tomorrow' : DAY_LABELS[weekday]
    return {
      label: `Opens ${dayLabel} at ${formatTime12h(row.open_time)}`,
      dayOffset: offset,
      openTime: row.open_time,
      minutesUntil: offset === 0 ? open - nowMinutes : offset * 1440 + open - nowMinutes,
    }
  }

  return null
}

/** The `hours` block the storefront endpoints return, as screens receive it. */
export type StorefrontHours = {
  days?: DayHours[]
  isOpenNow?: boolean
  acceptOrdersOutsideHours?: boolean
  today?: string
  /** "Opens today at 10:00 AM" or null when unknown/open. */
  opensAt?: string | null
  /** False when the owner has not set a schedule. Orders must never be blocked. */
  hoursConfigured?: boolean
}

/**
 * The single client-side rule, mirroring the server gate in app/api/orders.
 *
 * Paused only when all three are true: the owner turned the setting off, hours
 * exist, and it is currently outside them. Missing data always means "order".
 */
export function isOrderingPaused(hours: StorefrontHours | null | undefined): boolean {
  if (!hours) return false
  if (hours.acceptOrdersOutsideHours !== false) return false
  const configured = hours.hoursConfigured ?? hasConfiguredHours(hours.days ?? [])
  if (!configured) return false
  return hours.isOpenNow === false
}

export type OrderingDecision = {
  /** False only when an order must be refused right now. */
  allowed: boolean
  openNow: boolean
  /** False when the owner has no schedule yet. */
  hoursConfigured: boolean
  /** "Opens today at 10:00 AM", or null when open / unknown. */
  opensAt: string | null
}

/**
 * The pure decision behind the server gate, so it can be reasoned about (and
 * tested) without a database. `now` must be a Lagos-shifted Date: see lagosNow.
 *
 * The only "no" is: the owner turned the setting off, a schedule exists, and it
 * is currently outside it. Everything else - no schedule, no settings, a broken
 * lookup - answers "allowed", because an order is never lost to missing data.
 */
export function evaluateOrdering(
  days: DayHours[] | null | undefined,
  acceptOrdersOutsideHours: boolean,
  now: Date,
): OrderingDecision {
  const list = Array.isArray(days) ? days : []
  if (!hasConfiguredHours(list)) {
    return { allowed: true, openNow: true, hoursConfigured: false, opensAt: null }
  }

  const openNow = isOpenAt(list, now)
  const opensAt = openNow ? null : nextOpeningAt(list, now)?.label ?? null

  if (acceptOrdersOutsideHours !== false) {
    return { allowed: true, openNow, hoursConfigured: true, opensAt }
  }

  return { allowed: openNow, openNow, hoursConfigured: true, opensAt }
}
