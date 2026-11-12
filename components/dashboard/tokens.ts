/**
 * Shared vocabulary for the dashboard design system.
 *
 * Everything here is presentation only. It exists so screens stop inventing
 * their own colours, spacing and number formats. The CSS variables referenced
 * below are declared once in app/globals.css under "Dashboard design system
 * tokens (Batch 3A, additive)".
 */

export type Tone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info'

/** Pill / badge surfaces. Text tones are chosen to clear WCAG AA on their own background. */
export const toneSurface: Record<Tone, string> = {
  neutral: 'bg-[var(--dash-surface-inset)] text-[var(--dash-ink-2)] border-[var(--dash-line)]',
  brand: 'bg-[var(--dash-sand)] text-[var(--dash-brown-deep)] border-[var(--dash-sand-deep)]',
  success: 'bg-[var(--dash-success-bg)] text-[var(--dash-success)] border-transparent',
  warning: 'bg-[var(--dash-warning-bg)] text-[var(--dash-warning)] border-transparent',
  danger: 'bg-[var(--dash-danger-bg)] text-[var(--dash-danger)] border-transparent',
  info: 'bg-[var(--dash-info-bg)] text-[var(--dash-info)] border-transparent',
}

export const toneDot: Record<Tone, string> = {
  neutral: 'bg-[var(--dash-ink-4)]',
  brand: 'bg-[var(--dash-brown)]',
  success: 'bg-[var(--dash-success)]',
  warning: 'bg-[var(--dash-warning)]',
  danger: 'bg-[var(--dash-danger)]',
  info: 'bg-[var(--dash-info)]',
}

export const toneText: Record<Tone, string> = {
  neutral: 'text-[var(--dash-ink-3)]',
  brand: 'text-[var(--dash-brown)]',
  success: 'text-[var(--dash-success)]',
  warning: 'text-[var(--dash-warning)]',
  danger: 'text-[var(--dash-danger)]',
  info: 'text-[var(--dash-info)]',
}

/** Maps domain values onto one of the six tones. Unknown values stay neutral, never guessed. */
export function statusTone(value: string | null | undefined): { tone: Tone; label: string } {
  const raw = String(value ?? '').trim().toLowerCase().replace(/[\s-]+/g, '_')
  if (!raw) return { tone: 'neutral', label: 'Unknown' }
  const labelOf = (input: string) => input.charAt(0).toUpperCase() + input.slice(1).replace(/_/g, ' ')

  if (['active', 'verified', 'paid', 'completed', 'settled', 'confirmed', 'resolved', 'ready', 'approved'].includes(raw)) {
    return { tone: 'success', label: labelOf(raw) }
  }
  if (['pending', 'processing', 'in_progress', 'awaiting', 'partial', 'unsettled', 'queued', 'scheduled'].includes(raw)) {
    return { tone: 'warning', label: labelOf(raw) }
  }
  if (['failed', 'rejected', 'cancelled', 'canceled', 'suspended', 'blocked', 'expired', 'error', 'unverified'].includes(raw)) {
    return { tone: 'danger', label: labelOf(raw) }
  }
  if (['new', 'draft', 'coming_next', 'beta'].includes(raw)) return { tone: 'info', label: labelOf(raw) }
  return { tone: 'neutral', label: labelOf(raw) }
}

/* ------------------------------- numbers ------------------------------- */

const naira = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const nairaWhole = new Intl.NumberFormat('en-NG', {
  style: 'currency',
  currency: 'NGN',
  maximumFractionDigits: 0,
})

const plain = new Intl.NumberFormat('en-NG')

/**
 * Money text. Always render inside a `.dash-num` element so digits line up in
 * columns; that is the point of tabular numerals.
 */
export function money(value: number | string | null | undefined, options?: { whole?: boolean }): string {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount)) return options?.whole ? '₦0' : '₦0.00'
  return options?.whole ? nairaWhole.format(amount) : naira.format(amount)
}

export function count(value: number | null | undefined): string {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount)) return '0'
  return plain.format(amount)
}

export function percent(value: number | null | undefined, digits = 0): string {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount)) return '0%'
  return `${amount.toFixed(digits)}%`
}

/** Long, unambiguous dates. Storefront-facing copy should be explicit about time. */
export function dateTime(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function relativeTime(value: string | Date | null | undefined, now = Date.now()): string {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const diff = Math.round((date.getTime() - now) / 1000)
  const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
    ['year', 31536000],
    ['month', 2592000],
    ['week', 604800],
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60],
  ]
  const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
  for (const [unit, seconds] of units) {
    if (Math.abs(diff) >= seconds) return formatter.format(Math.round(diff / seconds), unit)
  }
  return 'just now'
}

/** Nigerian MSISDN in local form for display: 0803 123 4567. */
export function formatNigerianPhone(value: string | null | undefined): string {
  if (!value) return '—'
  const digits = value.replace(/\D/g, '')
  const local = digits.startsWith('234') ? `0${digits.slice(3)}` : digits
  if (local.length !== 11) return value
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`
}

/** Page-level spacing rhythm. 4/8 scale, nothing in between. */
export const rhythm = {
  stackTight: 'gap-2',
  stack: 'gap-4',
  stackLoose: 'gap-6',
  section: 'gap-6',
  page: 'gap-6 sm:gap-8',
} as const
