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
