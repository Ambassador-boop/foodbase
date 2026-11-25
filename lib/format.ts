/**
 * Formatting for money and dates.
 *
 * Money is the reason this file exists. Postgres returns NUMERIC as a string,
 * and a naira amount must never pass through a JavaScript float: 0.1 + 0.2 is
 * not 0.3, and a settlement that is one kobo out is a support ticket. So every
 * amount is formatted by operating on its decimal digits, never by dividing or
 * multiplying them.
 *
 * Dates are always shown in Africa/Lagos, whatever the viewer's device is set
 * to: a Lagos restaurant reading "yesterday's orders" needs Lagos midnight, not
 * the reader's.
 */

const LAGOS = 'Africa/Lagos'

/* ------------------------------------------------------------------- money */

export type NairaOptions = {
  /** Show the Naira sign. Off for inputs and for columns with a unit header. */
  symbol?: boolean
  /** 2 keeps the kobo, 0 drops them. Default 2: prices are quoted to the kobo. */
  decimals?: 0 | 2
  /** Show a plus sign on positive values. Used by ledgers. */
  signed?: boolean
}

type Decimal = { negative: boolean; whole: string; fraction: string }

/** Rounds a decimal string to two places, half away from zero, in string space. */
function roundFraction(fraction: string): { fraction: string; carry: number } {
  const digits = fraction.padEnd(3, '0')
  const keep = digits.slice(0, 2)
  const next = Number(digits.charAt(2))
  if (next < 5) return { fraction: keep, carry: 0 }
  const bumped = (Number(keep) + 1).toString().padStart(2, '0')
  // 99 + 1 = 100: the hundreds digit carries into the whole part.
  if (bumped.length > 2) return { fraction: bumped.slice(1), carry: 1 }
  return { fraction: bumped, carry: 0 }
}

/** Increments a run of digits that may be longer than Number can hold exactly. */
function incrementDigits(whole: string): string {
  const chars = whole.split('')
  let i = chars.length - 1
  while (i >= 0) {
    if (chars[i] === '9') {
      chars[i] = '0'
      i -= 1
    } else {
      chars[i] = String(Number(chars[i]) + 1)
      return chars.join('')
    }
  }
  return '1' + chars.join('')
}

function toDecimal(value: string | number | bigint | null | undefined): Decimal {
  const empty: Decimal = { negative: false, whole: '0', fraction: '00' }
  if (value === null || value === undefined) return empty

  let raw: string
  if (typeof value === 'bigint') raw = value.toString()
  else if (typeof value === 'number') {
    if (!Number.isFinite(value)) return empty
    raw = String(value)
  } else raw = String(value)

  raw = raw.trim()
  if (raw === '') return empty

  let negative = false
  if (raw.startsWith('-')) {
    negative = true
    raw = raw.slice(1)
  } else if (raw.startsWith('+')) {
    raw = raw.slice(1)
  }

  // Tolerate values that arrive pre-formatted ("₦1,200.00").
  raw = raw.replace(/[₦,\s]/g, '')
  if (raw === '') return empty

  const [wholePart = '0', fractionPart = ''] = raw.split('.')
  if (!/^\d*$/.test(wholePart) || !/^\d*$/.test(fractionPart)) return empty

  const whole = (wholePart.replace(/^0+(?=\d)/, '') || '0').replace(/^0+(?=\d)/, '') || '0'
  const { fraction, carry } = roundFraction(fractionPart)
  const wholeAfterCarry = carry ? incrementDigits(whole) : whole

  return { negative, whole: wholeAfterCarry, fraction }
}

function group(whole: string): string {
  return whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/**
 * Formats a naira amount.
 *
 *   formatNaira('1234567.89')  -> '₦1,234,567.89'
 *   formatNaira('-1200')       -> '-₦1,200.00'
 *   formatNaira(0)             -> '₦0.00'
 *
 * The minus sign goes before the Naira sign, so a debit reads as one negative
 * quantity rather than a negative number of naira.
 */
export function formatNaira(
  value: string | number | bigint | null | undefined,
  options: NairaOptions = {},
): string {
  const { symbol = true, decimals = 2, signed = false } = options
  const decimal = toDecimal(value)
  const isZero = decimal.whole === '0' && /^0+$/.test(decimal.fraction)

  const sign = decimal.negative ? '-' : signed && !isZero ? '+' : ''
  const body = decimals === 2 ? `${group(decimal.whole)}.${decimal.fraction}` : group(decimal.whole)

  return `${sign}${symbol ? '₦' : ''}${body}`
}

/**
 * Splits an amount into sign, symbol and number so a caller can style the
 * parts (for example a smaller decimal). Same digits, same rules.
 */
export function splitNaira(
  value: string | number | bigint | null | undefined,
): { sign: string; symbol: string; whole: string; fraction: string } {
  const decimal = toDecimal(value)
  return {
    sign: decimal.negative ? '-' : '',
    symbol: '₦',
    whole: group(decimal.whole),
    fraction: decimal.fraction,
  }
}

/** True when the amount is exactly zero, without going through a float. */
export function isZeroAmount(value: string | number | bigint | null | undefined): boolean {
  const decimal = toDecimal(value)
  return decimal.whole === '0' && /^0+$/.test(decimal.fraction)
}

/* ------------------------------------------------------------------- dates */

function toDate(input: string | number | Date | null | undefined): Date | null {
  if (input === null || input === undefined || input === '') return null
  const date = input instanceof Date ? input : new Date(input)
  return Number.isNaN(date.getTime()) ? null : date
}

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  timeZone: LAGOS,
})

const dateTimeFormat = new Intl.DateTimeFormat('en-GB', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: LAGOS,
})

const timeFormat = new Intl.DateTimeFormat('en-GB', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: LAGOS,
})

/** '30 Dec 2026'. Returns an em dash for an empty or unparseable value. */
export function formatDate(input: string | number | Date | null | undefined): string {
  const date = toDate(input)
  return date ? dateFormat.format(date) : '—'
}

/** '30 Dec 2026, 4:30 pm'. */
export function formatDateTime(input: string | number | Date | null | undefined): string {
  const date = toDate(input)
  return date ? dateTimeFormat.format(date) : '—'
}

/** '4:30 pm', for a kitchen timer or a row where the date is already known. */
export function formatTime(input: string | number | Date | null | undefined): string {
  const date = toDate(input)
  return date ? timeFormat.format(date) : '—'
}
