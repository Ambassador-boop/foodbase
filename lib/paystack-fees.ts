/**
 * Paystack transfer pricing, held in ONE place.
 *
 * Sources (checked 12 November 2026):
 * - Transfers pricing — https://support.paystack.com/en/articles/2130370
 *     Nigeria: transfers of NGN 5,000 and below ............ NGN 10 per successful transfer
 *              transfers between NGN 5,001 and 50,000 ..... NGN 25 per successful transfer
 *              transfers above NGN 50,000 ................. NGN 50 per successful transfer
 *     "Transfers charges are deducted from your Paystack Balance."
 * - Stamp duty on NGN transfers — https://support.paystack.com/en/articles/7573314
 *     A flat NGN 50 stamp duty (Nigeria Tax Act 2025) is deducted on every NGN
 *     transfer of NGN 10,000 or more, charged separately from the transfer fee,
 *     and it is never refunded. In force since 18 February 2026.
 *
 * The provider does not return a fee on the transfer object: the documented
 * payloads for POST /transfer, GET /transfer and GET /transfer/verify/:reference
 * carry amount, status, transfer_code, recipient, reference and timestamps, and
 * no fee field. So the figure is computed from the tables above, and the recorded
 * fee_source is 'computed'. If Paystack ever does return a fee on a transfer, the
 * caller prefers it and records the fee_source as 'provider'.
 */

export interface PaystackFeeBand {
  /** Highest transfer amount in naira this band covers. Null means no ceiling. */
  upTo: number | null
  /** Transfer fee in naira. */
  fee: number
}

export const PAYSTACK_TRANSFER_FEES = {
  currency: 'NGN',
  bands: [
    { upTo: 5000, fee: 10 },
    { upTo: 50000, fee: 25 },
    { upTo: null, fee: 50 },
  ] as PaystackFeeBand[],
  /** Flat government levy on transfers at or above the threshold. */
  stampDuty: { threshold: 10000, amount: 50 },
  /** What `admin_transfers.provider_fee` was derived from. */
  source: 'computed',
} as const

function naira(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

/** Paystack's own transfer fee for an NGN transfer of `amount` naira. */
export function transferFeeNaira(amount: number): number {
  const value = naira(amount)
  if (value <= 0) return 0
  for (const band of PAYSTACK_TRANSFER_FEES.bands) {
    if (band.upTo === null || value <= band.upTo) return band.fee
  }
  return 0
}

/** The NGN 50 stamp duty Paystack deducts on qualifying transfers. */
export function transferStampDutyNaira(amount: number): number {
  const value = naira(amount)
  if (value < PAYSTACK_TRANSFER_FEES.stampDuty.threshold) return 0
  return PAYSTACK_TRANSFER_FEES.stampDuty.amount
}

export interface TransferFeeBreakdown {
  amount: number
  transferFee: number
  stampDuty: number
  /** What Paystack actually takes from the balance: transfer fee + stamp duty. */
  total: number
  source: 'computed' | 'provider'
}

/** Fee, stamp duty and total cost of sending `amount` naira. */
export function transferFeeBreakdown(amount: number): TransferFeeBreakdown {
  const value = round2(naira(amount))
  const transferFee = transferFeeNaira(value)
  const stampDuty = transferStampDutyNaira(value)
  return {
    amount: value,
    transferFee,
    stampDuty,
    total: round2(transferFee + stampDuty),
    source: 'computed',
  }
}

/**
 * A fee reported by the provider on a transfer payload, in naira, if there is one.
 * Paystack reports money on transfer objects in kobo, so the value is divided by
 * 100. Returns null when the payload carries no usable fee, which is the case for
 * every documented transfer response today.
 */
export function providerTransferFeeNaira(data: any): number | null {
  if (!data || typeof data !== 'object') return null
  for (const key of ['fee_charged', 'fee', 'transfer_fee'] as const) {
    const raw = (data as Record<string, unknown>)[key]
    if (raw === null || raw === undefined || raw === '') continue
    const kobo = Number(raw)
    if (!Number.isFinite(kobo) || kobo < 0) continue
    const transferAmountKobo = Number((data as Record<string, unknown>).amount)
    // A fee larger than the transfer itself is not a fee; ignore nonsense.
    if (Number.isFinite(transferAmountKobo) && transferAmountKobo > 0 && kobo > transferAmountKobo) continue
    return round2(kobo / 100)
  }
  return null
}

/**
 * The fee to record for one admin transfer: the provider's figure when it exists,
 * otherwise the computed total. `fee_source` says which of the two it was.
 */
export function resolveTransferFee(amount: number, data?: any): { fee: number; source: 'computed' | 'provider'; breakdown: TransferFeeBreakdown } {
  const breakdown = transferFeeBreakdown(amount)
  const providerFee = providerTransferFeeNaira(data)
  if (providerFee !== null) return { fee: providerFee, source: 'provider', breakdown }
  return { fee: breakdown.total, source: PAYSTACK_TRANSFER_FEES.source, breakdown }
}
