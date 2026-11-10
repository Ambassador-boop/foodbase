import { formatNaira } from '@/lib/finance'

const nairaFormatter = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

const countFormatter = new Intl.NumberFormat('en-NG')

const compactFormatter = new Intl.NumberFormat('en-NG', {
  notation: 'compact',
  maximumFractionDigits: 1,
})

/** Exact naira amount, e.g. ₦23,905.37. Never rounds away kobo. */
export function money(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return formatNaira(Number(value))
}

/** Short naira amount for tight spaces, e.g. ₦1.2M. Always provide the exact value nearby. */
export function moneyCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  const amount = Number(value)
  if (Math.abs(amount) < 100_000) return nairaFormatter.format(amount)
  return `₦${compactFormatter.format(amount)}`
}

export function count(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return countFormatter.format(Number(value))
}

export function percent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  return `${Number(value).toFixed(digits)}%`
}

export function deltaLabel(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—'
  const rounded = Math.abs(Number(value)) < 0.05 ? 0 : Number(value)
  const sign = rounded > 0 ? '+' : rounded < 0 ? '−' : ''
  return `${sign}${Math.abs(rounded).toFixed(1)}%`
}

const dateFormatter = new Intl.DateTimeFormat('en-NG', {
  timeZone: 'Africa/Lagos',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('en-NG', {
  timeZone: 'Africa/Lagos',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

const timeFormatter = new Intl.DateTimeFormat('en-NG', {
  timeZone: 'Africa/Lagos',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
})

const shortDayFormatter = new Intl.DateTimeFormat('en-NG', {
  timeZone: 'Africa/Lagos',
  day: 'numeric',
  month: 'short',
})

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function dateWat(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? dateFormatter.format(date) : '—'
}

export function dateTimeWat(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? `${dateTimeFormatter.format(date)} WAT` : '—'
}

export function timeWat(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? timeFormatter.format(date) : '—'
}

export function shortDay(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? shortDayFormatter.format(date) : '—'
}

/** "Today", "Yesterday", or a WAT date for a chart day (YYYY-MM-DD). */
export function relativeDay(value: string): string {
  const date = toDate(`${value}T12:00:00+01:00`)
  if (!date) return value
  const today = new Date()
  const todayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(today)
  const yesterdayKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos' }).format(
    new Date(today.getTime() - 86_400_000),
  )
  if (value === todayKey) return 'Today'
  if (value === yesterdayKey) return 'Yesterday'
  return shortDayFormatter.format(date)
}

export function maskAccount(value: string | null | undefined): string {
  if (!value) return '—'
  const digits = value.replace(/\s+/g, '')
  return digits.length <= 4 ? digits : `•••• ${digits.slice(-4)}`
}

/** Turns `sms_funding` into `SMS funding`, `unreconciled_balance` into `Unreconciled balance`. */
export function humanise(value: string | null | undefined): string {
  if (!value) return '—'
  const normalised = String(value).replace(/[_-]+/g, ' ').trim().toLowerCase()
  return normalised.charAt(0).toUpperCase() + normalised.slice(1)
}
