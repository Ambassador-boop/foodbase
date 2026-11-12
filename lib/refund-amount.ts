/**
 * Read a refund's amount in one unit.
 *
 * The `refunds` table stores the same figure twice, in different units:
 *   refund_amount  numeric  naira  — written by fb_request_refund, the source of truth
 *   amount         integer  kobo   — legacy column, written before the split
 *
 * Reading the wrong one is a 100x error, so every consumer should come through
 * here instead of reaching for a column directly. This file reads only; it never
 * writes, and it does not change the schema or either column.
 */

export interface RefundAmountShape {
  /** Naira. Null/undefined on legacy rows. */
  refund_amount?: number | string | null
  /** Kobo. */
  amount?: number | string | null
}

function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * The refund amount in naira. `refund_amount` wins whenever it is present
 * (including a stored 0); `amount` is treated as kobo and converted only when
 * `refund_amount` is missing, which is the legacy shape.
 */
export function refundAmountNaira(refund: RefundAmountShape | null | undefined): number {
  const naira = toNumber(refund?.refund_amount)
  if (naira !== null) return round2(naira)
  const kobo = toNumber(refund?.amount)
  if (kobo !== null) return round2(kobo / 100)
  return 0
}

/** The refund amount in kobo, for provider payloads that expect the subunit. */
export function refundAmountKobo(refund: RefundAmountShape | null | undefined): number {
  return Math.round(refundAmountNaira(refund) * 100)
}

/** Which column the value came from, for logging and audits. */
export function refundAmountSource(refund: RefundAmountShape | null | undefined): 'refund_amount' | 'amount' | 'none' {
  if (toNumber(refund?.refund_amount) !== null) return 'refund_amount'
  if (toNumber(refund?.amount) !== null) return 'amount'
  return 'none'
}
