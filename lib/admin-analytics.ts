/**
 * Read-only analytics queries for the admin dashboard.
 *
 * Money rules (verified against the payment code and the live schema):
 * - An order is paid when `orders.payment_status IN ('paid', 'completed')`.
 *   That is the exact condition `fb_settle_payment` checks, and the only place
 *   a payment is marked successful.
 * - All money columns are naira. `transactions.provider_fee` is stored in naira
 *   (the kobo value from Paystack is divided by 100 inside `fb_settle_payment`).
 * - Service fee revenue comes from `orders.service_fee_amount` on paid orders.
 *   It matches `order_service_fees.service_fee_amount` exactly where both exist
 *   and also covers paid orders created before the fee table was introduced.
 * - The Paystack fee per payment is `transactions.provider_fee`. It is NULL when
 *   Paystack did not return a fee, so it is reported as "not recorded", never 0.
 * - Withdrawal fee revenue only counts withdrawals with status 'success';
 *   `fb_credit_withdrawal_fee` refuses to credit any other status.
 */

import { query } from '@/lib/db'
import { periodSqlParams, nextSettlementRun } from '@/lib/admin-period'
import type { AdminPeriod } from '@/lib/admin-period'
import { getPaystackBalance } from '@/lib/paystack'

export const PAID_ORDER_CONDITION = "o.payment_status IN ('paid', 'completed')"

/** True when an order counts as paid. Kept in one place for every analytics query. */
export function isPaidPaymentStatus(status: unknown): boolean {
  return String(status ?? '').toLowerCase() === 'paid' || String(status ?? '').toLowerCase() === 'completed'
}

export async function queryRows<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const result: any = await query(text, params)
  if (Array.isArray(result)) return result as T[]
  return (result?.rows ?? []) as T[]
}

export async function queryRow<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  const result = await queryRows<T>(text, params)
  return result[0] ?? null
}

export function num(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

/**
 * Range predicate for columns stored as `timestamp without time zone` holding UTC.
 * Both bounds are optional; the end bound is exclusive.
 */
function naiveRange(expression: string): string {
  return `($1::timestamptz IS NULL OR ${expression} >= $1::timestamptz AT TIME ZONE 'UTC')
      AND ${expression} < $2::timestamptz AT TIME ZONE 'UTC'`
}

/** Range predicate for `timestamp with time zone` columns. */
function awareRange(expression: string): string {
  return `($1::timestamptz IS NULL OR ${expression} >= $1::timestamptz)
      AND ${expression} < $2::timestamptz`
}

/** Calendar day in WAT for a naive UTC timestamp column, as YYYY-MM-DD. */
function naiveWatDay(expression: string): string {
  return `(((${expression}) + interval '1 hour')::date)::text`
}

/** Calendar day in WAT for a timestamptz column, as YYYY-MM-DD. */
function awareWatDay(expression: string): string {
  return `(((${expression}) AT TIME ZONE 'Africa/Lagos')::date)::text`
}

export interface MetricChange {
  current: number
  previous: number | null
  changePct: number | null
  direction: 'up' | 'down' | 'flat'
  /** True when there is no comparable previous figure (e.g. first month of trading). */
  noBaseline: boolean
}

function change(current: number, previous: number | null): MetricChange {
  if (previous === null) {
    return { current, previous: null, changePct: null, direction: current === 0 ? 'flat' : 'up', noBaseline: true }
  }
  const rounded = round2(previous)
  if (rounded === 0) {
    return { current, previous: rounded, changePct: null, direction: current === 0 ? 'flat' : 'up', noBaseline: current !== 0 }
  }
  const changePct = round2(((current - rounded) / Math.abs(rounded)) * 100)
  return {
    current,
    previous: rounded,
    changePct,
    direction: changePct === 0 ? 'flat' : changePct > 0 ? 'up' : 'down',
    noBaseline: false,
  }
}

export interface PaidSummary {
  paidOrders: number
  volume: number
  serviceFees: number
  paystackFees: number
  paystackFeePayments: number
  paymentsWithTransaction: number
}

/** Paid order totals for one period. */
export async function getPaidSummary(period: AdminPeriod): Promise<PaidSummary> {
  const [start, end] = periodSqlParams(period)
  const result = await queryRow<Record<string, unknown>>(
    `SELECT
        count(*)::int AS paid_orders,
        coalesce(sum(o.total_amount), 0)::float8 AS volume,
        coalesce(sum(o.service_fee_amount), 0)::float8 AS service_fees,
        coalesce(sum(tx.provider_fees), 0)::float8 AS paystack_fees,
        coalesce(sum(tx.recorded), 0)::int AS paystack_fee_payments,
        coalesce(sum(tx.payments), 0)::int AS payments_with_transaction
      FROM orders o
      LEFT JOIN LATERAL (
        SELECT coalesce(sum(t.provider_fee), 0)::float8 AS provider_fees,
               count(*) FILTER (WHERE t.provider_fee IS NOT NULL)::int AS recorded,
               count(*)::int AS payments
        FROM transactions t
        WHERE t.order_id = o.id AND t.transaction_type = 'payment' AND t.status = 'completed'
      ) tx ON TRUE
      WHERE ${PAID_ORDER_CONDITION}
        AND ${naiveRange('coalesce(o.paid_at, o.created_at)')}`,
    [start, end],
  )
  return {
    paidOrders: num(result?.paid_orders),
    volume: round2(num(result?.volume)),
    serviceFees: round2(num(result?.service_fees)),
    paystackFees: round2(num(result?.paystack_fees)),
    paystackFeePayments: num(result?.paystack_fee_payments),
    paymentsWithTransaction: num(result?.payments_with_transaction),
  }
}

export interface OrderFunnel {
  created: number
  paid: number
  failed: number
  abandoned: number
  inProgress: number
  conversionRate: number | null
}

/** Orders created in the period, split by what happened to them. */
export async function getOrderFunnel(period: AdminPeriod): Promise<OrderFunnel> {
  const [start, end] = periodSqlParams(period)
  const result = await queryRow<Record<string, unknown>>(
    `SELECT
        count(*)::int AS created,
        count(*) FILTER (WHERE o.payment_status IN ('paid', 'completed'))::int AS paid,
        count(*) FILTER (
          WHERE o.payment_status NOT IN ('paid', 'completed')
            AND (o.status::text = 'cancelled' OR o.payment_status IN ('failed', 'reversed', 'abandoned'))
        )::int AS failed,
        count(*) FILTER (
          WHERE o.payment_status NOT IN ('paid', 'completed')
            AND o.status::text <> 'cancelled'
            AND coalesce(o.payment_status, '') NOT IN ('failed', 'reversed', 'abandoned')
            AND o.created_at < (now() AT TIME ZONE 'UTC') - interval '1 hour'
        )::int AS abandoned,
        count(*) FILTER (
          WHERE o.payment_status NOT IN ('paid', 'completed')
            AND o.status::text <> 'cancelled'
            AND coalesce(o.payment_status, '') NOT IN ('failed', 'reversed', 'abandoned')
            AND o.created_at >= (now() AT TIME ZONE 'UTC') - interval '1 hour'
        )::int AS in_progress
      FROM orders o
      WHERE ${naiveRange('o.created_at')}`,
    [start, end],
  )
  const created = num(result?.created)
  const paid = num(result?.paid)
  const failed = num(result?.failed)
  const abandoned = num(result?.abandoned)
  const inProgress = num(result?.in_progress)
  return {
    created,
    paid,
    failed,
    abandoned,
    inProgress,
    conversionRate: created > 0 ? round2((paid / created) * 100) : null,
  }
}

export interface RefundSummary {
  count: number
  amount: number
  rate: number | null
  failedCount: number
  failedAmount: number
  pendingCount: number
  pendingAmount: number
}

export async function getRefundSummary(period: AdminPeriod, paymentsVolume: number): Promise<RefundSummary> {
  const [start, end] = periodSqlParams(period)
  const result = await queryRow<Record<string, unknown>>(
    `SELECT
        count(*) FILTER (WHERE status = 'processed')::int AS processed_count,
        coalesce(sum(refund_amount) FILTER (WHERE status = 'processed'), 0)::float8 AS processed_amount,
        count(*) FILTER (WHERE status IN ('failed', 'rejected'))::int AS failed_count,
        coalesce(sum(refund_amount) FILTER (WHERE status IN ('failed', 'rejected')), 0)::float8 AS failed_amount,
        count(*) FILTER (WHERE status IN ('pending', 'processing'))::int AS pending_count,
        coalesce(sum(refund_amount) FILTER (WHERE status IN ('pending', 'processing')), 0)::float8 AS pending_amount
      FROM refunds
      WHERE ${naiveRange('coalesce(processed_at, created_at)')}`,
    [start, end],
  )
  const amount = round2(num(result?.processed_amount))
  return {
    count: num(result?.processed_count),
    amount,
    rate: paymentsVolume > 0 ? round2((amount / paymentsVolume) * 100) : null,
    failedCount: num(result?.failed_count),
    failedAmount: round2(num(result?.failed_amount)),
    pendingCount: num(result?.pending_count),
    pendingAmount: round2(num(result?.pending_amount)),
  }
}

export interface WithdrawalStatusRow {
  status: string
  count: number
  amount: number
  fee: number
}

export interface WithdrawalSummary {
  byStatus: WithdrawalStatusRow[]
  successCount: number
  successAmount: number
  feeRevenue: number
  pendingCount: number
  pendingAmount: number
  failedCount: number
  failedAmount: number
}

export async function getWithdrawalSummary(period: AdminPeriod): Promise<WithdrawalSummary> {
  const [start, end] = periodSqlParams(period)
  const result = await queryRows<Record<string, unknown>>(
    `SELECT lower(status::text) AS status,
            count(*)::int AS count,
            coalesce(sum(amount), 0)::float8 AS amount,
            coalesce(sum(withdrawal_fee), 0)::float8 AS fee
       FROM withdrawals
      WHERE ${naiveRange('coalesce(processed_at, created_at)')}
      GROUP BY lower(status::text)
      ORDER BY count(*) DESC`,
    [start, end],
  )
  const byStatus = result.map((entry) => ({
    status: String(entry.status ?? 'unknown'),
    count: num(entry.count),
    amount: round2(num(entry.amount)),
    fee: round2(num(entry.fee)),
  }))
  const find = (statuses: string[]) => byStatus.filter((entry) => statuses.includes(entry.status))
  const sumOf = (entries: WithdrawalStatusRow[], key: 'count' | 'amount' | 'fee') =>
    round2(entries.reduce((total, entry) => total + entry[key], 0))
  const success = find(['success', 'completed', 'processed'])
  const pending = find(['pending', 'processing', 'otp', 'received', 'queued', 'approved'])
  const failed = find(['failed', 'rejected', 'abandoned', 'blocked', 'reversed'])
  return {
    byStatus,
    successCount: sumOf(success, 'count'),
    successAmount: sumOf(success, 'amount'),
    // Only successful withdrawals credit a fee (see fb_credit_withdrawal_fee).
    feeRevenue: sumOf(success, 'fee'),
    pendingCount: sumOf(pending, 'count'),
    pendingAmount: sumOf(pending, 'amount'),
    failedCount: sumOf(failed, 'count'),
    failedAmount: sumOf(failed, 'amount'),
  }
}

export interface SmsSummary {
  /** Amount funded plus the Paystack fees paid to send it. The real cost. */
  spend: number
  /** The amounts funded, without the transfer fees. */
  amountsFunded: number
  /** Paystack transfer fees + stamp duty recorded on those transfers. */
  smsTransferFees: number
  transfers: number
  pendingTransfers: number
  recorded: boolean
}

/**
 * SMS wallet funding transfers that actually left the platform balance, plus the
 * Paystack cost of sending them.
 *
 * Paystack deducts the transfer fee (and the ₦50 stamp duty at ₦10,000 and above)
 * from the balance, so the amount funded alone understates what the platform spent.
 * `fb_admin_record_transfer_fee` stores that fee on `admin_transfers.provider_fee`;
 * when the column or the function is not there yet the summary still renders, with
 * the fee reported as 0 rather than failing the whole dashboard.
 */
export async function getSmsSummary(period: AdminPeriod): Promise<SmsSummary> {
  const [start, end] = periodSqlParams(period)
  const deducted = 'balance_deducted AND NOT coalesce(balance_reversed, false)'
  const withFees = `SELECT
        coalesce(sum(amount) FILTER (WHERE ${deducted}), 0)::float8 AS funded,
        coalesce(sum(coalesce(provider_fee, 0)) FILTER (WHERE ${deducted}), 0)::float8 AS fees,
        count(*) FILTER (WHERE ${deducted})::int AS transfers,
        count(*) FILTER (WHERE lower(status) NOT IN ('success', 'completed', 'failed', 'reversed'))::int AS pending
       FROM admin_transfers
      WHERE kind = 'sms_funding' AND ${awareRange('created_at')}`
  const withoutFees = `SELECT
        coalesce(sum(amount) FILTER (WHERE ${deducted}), 0)::float8 AS funded,
        0::float8 AS fees,
        count(*) FILTER (WHERE ${deducted})::int AS transfers,
        count(*) FILTER (WHERE lower(status) NOT IN ('success', 'completed', 'failed', 'reversed'))::int AS pending
       FROM admin_transfers
      WHERE kind = 'sms_funding' AND ${awareRange('created_at')}`

  let result: Record<string, unknown> | null = null
  try {
    result = await queryRow<Record<string, unknown>>(withFees, [start, end])
  } catch (error) {
    console.error('[admin] provider_fee unavailable; SMS spend excludes transfer fees', error)
    result = await queryRow<Record<string, unknown>>(withoutFees, [start, end])
  }

  const amountsFunded = round2(num(result?.funded))
  const smsTransferFees = round2(num(result?.fees))
  return {
    spend: round2(amountsFunded + smsTransferFees),
    amountsFunded,
    smsTransferFees,
    transfers: num(result?.transfers),
    pendingTransfers: num(result?.pending),
    recorded: true,
  }
}

export interface SettlementSummary {
  pendingAmount: number
  pendingCount: number
  settledAmount: number
  settledCount: number
  nextRunAt: string | null
}

export async function getSettlementSummary(period: AdminPeriod): Promise<SettlementSummary> {
  const [start, end] = periodSqlParams(period)
  const pipeline = await queryRow<Record<string, unknown>>(
    `SELECT
        coalesce(sum(amount) FILTER (WHERE settlement_status = 'pending'), 0)::float8 AS pending_amount,
        count(*) FILTER (WHERE settlement_status = 'pending')::int AS pending_count
       FROM transactions
      WHERE transaction_type = 'payment' AND status = 'completed'`,
  )
  const settled = await queryRow<Record<string, unknown>>(
    `SELECT
        coalesce(sum(amount), 0)::float8 AS settled_amount,
        count(*)::int AS settled_count
       FROM transactions
      WHERE transaction_type = 'payment' AND status = 'completed' AND settlement_status = 'settled'
        AND ${naiveRange('coalesce(settled_at, created_at)')}`,
    [start, end],
  )
  const nextRun = nextSettlementRun()
  return {
    pendingAmount: round2(num(pipeline?.pending_amount)),
    pendingCount: num(pipeline?.pending_count),
    settledAmount: round2(num(settled?.settled_amount)),
    settledCount: num(settled?.settled_count),
    nextRunAt: nextRun.toISOString(),
  }
}

export interface BusinessTotals {
  total: number
  active: number
  owed: number
  deficitsTotal: number
  deficitCount: number
  availableTotal: number
  pendingTotal: number
  newInPeriod: number
  deficits: Array<{ id: string; name: string; balance: number }>
}

export async function getBusinessTotals(period: AdminPeriod): Promise<BusinessTotals> {
  const [start, end] = periodSqlParams(period)
  const totals = await queryRow<Record<string, unknown>>(
    `SELECT
        count(*)::int AS total,
        count(*) FILTER (WHERE is_active)::int AS active,
        coalesce(sum(GREATEST(coalesce(available_balance, 0) + coalesce(pending_balance, 0), 0)), 0)::float8 AS owed,
        coalesce(sum(LEAST(coalesce(available_balance, 0) + coalesce(pending_balance, 0), 0)), 0)::float8 AS deficits_total,
        count(*) FILTER (WHERE coalesce(available_balance, 0) + coalesce(pending_balance, 0) < 0)::int AS deficit_count,
        coalesce(sum(available_balance), 0)::float8 AS available_total,
        coalesce(sum(pending_balance), 0)::float8 AS pending_total
       FROM businesses`,
  )
  const deficits = await queryRows<Record<string, unknown>>(
    `SELECT id, name, (coalesce(available_balance, 0) + coalesce(pending_balance, 0))::float8 AS balance
       FROM businesses
      WHERE coalesce(available_balance, 0) + coalesce(pending_balance, 0) < 0
      ORDER BY balance ASC
      LIMIT 50`,
  )
  const created = await queryRow<Record<string, unknown>>(
    `SELECT count(*)::int AS count FROM businesses WHERE ${naiveRange('created_at')}`,
    [start, end],
  )
  return {
    total: num(totals?.total),
    active: num(totals?.active),
    owed: round2(num(totals?.owed)),
    deficitsTotal: round2(num(totals?.deficits_total)),
    deficitCount: num(totals?.deficit_count),
    availableTotal: round2(num(totals?.available_total)),
    pendingTotal: round2(num(totals?.pending_total)),
    newInPeriod: num(created?.count),
    deficits: deficits.map((entry) => ({ id: String(entry.id), name: String(entry.name), balance: round2(num(entry.balance)) })),
  }
}

export interface DailyPoint {
  date: string
  volume: number
  paidOrders: number
  serviceFees: number
  paystackFees: number
  withdrawalFees: number
  net: number
  ordersCreated: number
  ordersFailed: number
}

/** WAT calendar days covered by a chart. "All time" is capped to the last 90 days. */
export function chartDays(period: AdminPeriod, maxDays = 90): string[] {
  const end = period.end
  const start = period.start ?? new Date(end.getTime() - (maxDays - 1) * 86_400_000)
  const out: string[] = []
  const endWall = new Date(end.getTime() + 3_600_000)
  let cursor = new Date(start.getTime() + 3_600_000)
  cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate()))
  while (cursor.getTime() < endWall.getTime() && out.length < 400) {
    out.push(cursor.toISOString().slice(0, 10))
    cursor = new Date(cursor.getTime() + 86_400_000)
  }
  return out
}

export async function getDailySeries(period: AdminPeriod): Promise<DailyPoint[]> {
  const days = chartDays(period)
  if (days.length === 0) return []
  const startIso = new Date(`${days[0]}T00:00:00.000+01:00`).toISOString()
  const endIso = new Date(new Date(`${days[days.length - 1]}T00:00:00.000+01:00`).getTime() + 86_400_000).toISOString()

  const [paidRows, withdrawalRows, orderRows] = await Promise.all([
    queryRows<Record<string, unknown>>(
      `SELECT ${naiveWatDay('coalesce(o.paid_at, o.created_at)')} AS day,
              count(*)::int AS paid_orders,
              coalesce(sum(o.total_amount), 0)::float8 AS volume,
              coalesce(sum(o.service_fee_amount), 0)::float8 AS service_fees,
              coalesce(sum(tx.provider_fees), 0)::float8 AS paystack_fees
         FROM orders o
         LEFT JOIN LATERAL (
           SELECT coalesce(sum(t.provider_fee), 0)::float8 AS provider_fees
             FROM transactions t
            WHERE t.order_id = o.id AND t.transaction_type = 'payment' AND t.status = 'completed'
         ) tx ON TRUE
        WHERE ${PAID_ORDER_CONDITION}
          AND coalesce(o.paid_at, o.created_at) >= $1::timestamptz AT TIME ZONE 'UTC'
          AND coalesce(o.paid_at, o.created_at) < $2::timestamptz AT TIME ZONE 'UTC'
        GROUP BY 1`,
      [startIso, endIso],
    ),
    queryRows<Record<string, unknown>>(
      `SELECT ${naiveWatDay('coalesce(processed_at, created_at)')} AS day,
              coalesce(sum(withdrawal_fee), 0)::float8 AS withdrawal_fees
         FROM withdrawals
        WHERE lower(status::text) IN ('success', 'completed', 'processed')
          AND coalesce(processed_at, created_at) >= $1::timestamptz AT TIME ZONE 'UTC'
          AND coalesce(processed_at, created_at) < $2::timestamptz AT TIME ZONE 'UTC'
        GROUP BY 1`,
      [startIso, endIso],
    ),
    queryRows<Record<string, unknown>>(
      `SELECT ${naiveWatDay('created_at')} AS day,
              count(*)::int AS created,
              count(*) FILTER (
                WHERE o.payment_status NOT IN ('paid', 'completed')
                  AND (o.status::text = 'cancelled' OR o.payment_status IN ('failed', 'reversed', 'abandoned'))
              )::int AS failed
         FROM orders o
        WHERE o.created_at >= $1::timestamptz AT TIME ZONE 'UTC'
          AND o.created_at < $2::timestamptz AT TIME ZONE 'UTC'
        GROUP BY 1`,
      [startIso, endIso],
    ),
  ])

  const paidByDay = new Map(paidRows.map((entry) => [String(entry.day), entry]))
  const withdrawalsByDay = new Map(withdrawalRows.map((entry) => [String(entry.day), entry]))
  const ordersByDay = new Map(orderRows.map((entry) => [String(entry.day), entry]))

  return days.map((day) => {
    const paid = paidByDay.get(day)
    const withdrawal = withdrawalsByDay.get(day)
    const orders = ordersByDay.get(day)
    const serviceFees = round2(num(paid?.service_fees))
    const paystackFees = round2(num(paid?.paystack_fees))
    const withdrawalFees = round2(num(withdrawal?.withdrawal_fees))
    return {
      date: day,
      volume: round2(num(paid?.volume)),
      paidOrders: num(paid?.paid_orders),
      serviceFees,
      paystackFees,
      withdrawalFees,
      net: round2(serviceFees + withdrawalFees - paystackFees),
      ordersCreated: num(orders?.created),
      ordersFailed: num(orders?.failed),
    }
  })
}

export interface TopBusiness {
  id: string
  name: string
  volume: number
  paidOrders: number
  serviceFees: number
}

export async function getTopBusinesses(period: AdminPeriod, limit = 6): Promise<TopBusiness[]> {
  const [start, end] = periodSqlParams(period)
  const result = await queryRows<Record<string, unknown>>(
    `SELECT b.id, b.name,
            coalesce(sum(o.total_amount), 0)::float8 AS volume,
            count(o.id)::int AS paid_orders,
            coalesce(sum(o.service_fee_amount), 0)::float8 AS service_fees
       FROM orders o
       JOIN businesses b ON b.id = o.business_id
      WHERE ${PAID_ORDER_CONDITION}
        AND ${naiveRange('coalesce(o.paid_at, o.created_at)')}
      GROUP BY b.id, b.name
      ORDER BY volume DESC
      LIMIT ${Math.max(1, Math.min(20, Math.floor(limit)))}`,
    [start, end],
  )
  return result.map((entry) => ({
    id: String(entry.id),
    name: String(entry.name),
    volume: round2(num(entry.volume)),
    paidOrders: num(entry.paid_orders),
    serviceFees: round2(num(entry.service_fees)),
  }))
}

/* -------------------------------------------------------------------------- */
/* Attention queue                                                            */
/* -------------------------------------------------------------------------- */

export interface AttentionCounts {
  anomalies: number
  stuckWithdrawals: number
  stuckRefunds: number
  pendingTransfers: number
  paidWithoutTransaction: number
}

export interface AttentionItem {
  id: string
  kind: string
  title: string
  detail: string
  amount: number | null
  status: string | null
  created_at: string | null
  href: string | null
  business_id?: string | null
  order_id?: string | null
  resolvable: boolean
  severity: 'danger' | 'warning' | 'info'
}

export interface AttentionQueue extends AttentionCounts {
  total: number
  rows: {
    anomalies: AttentionItem[]
    stuckWithdrawals: AttentionItem[]
    stuckRefunds: AttentionItem[]
    pendingTransfers: AttentionItem[]
    paidWithoutTransaction: AttentionItem[]
  }
  generatedAt: string
}

const ATTENTION_LIMIT = 50

/**
 * Everything that needs a human decision, built from read-only queries.
 * `reconcileBalances` is intentionally conservative: it compares the stored
 * business balance with the movements the ledger can prove, and only reports a
 * business when the gap is larger than ₦1 (rounding noise).
 */
export async function getAttentionQueue(options: { includeRows?: boolean } = {}): Promise<AttentionQueue> {
  const includeRows = options.includeRows !== false

  const [negativeBalances, anomalies, stuckWithdrawals, stuckRefunds, pendingTransfers, paidWithoutTransaction, reconciliation, pendingDrift, overRefunded] =
    await Promise.all([
      queryRows<Record<string, unknown>>(
        `SELECT id, name, available_balance::float8 AS available_balance, pending_balance::float8 AS pending_balance
           FROM businesses
          WHERE coalesce(available_balance, 0) < 0 OR coalesce(pending_balance, 0) < 0
          ORDER BY LEAST(coalesce(available_balance, 0), coalesce(pending_balance, 0)) ASC
          LIMIT ${ATTENTION_LIMIT}`,
      ),
      queryRows<Record<string, unknown>>(
        `SELECT id, reference, kind, details, created_at
           FROM payment_anomalies
          WHERE coalesce(resolved, false) = false
          ORDER BY created_at DESC
          LIMIT ${ATTENTION_LIMIT}`,
      ),
      queryRows<Record<string, unknown>>(
        `SELECT w.id, w.business_id, b.name AS business_name, w.amount::float8 AS amount,
                lower(w.status::text) AS status, w.created_at
           FROM withdrawals w
           LEFT JOIN businesses b ON b.id = w.business_id
          WHERE lower(w.status::text) IN ('pending', 'processing', 'otp', 'received', 'queued', 'approved')
            AND w.created_at < (now() AT TIME ZONE 'UTC') - interval '30 minutes'
          ORDER BY w.created_at ASC
          LIMIT ${ATTENTION_LIMIT}`,
      ),
      queryRows<Record<string, unknown>>(
        `SELECT r.id, r.order_id, r.business_id, b.name AS business_name,
                r.refund_amount::float8 AS amount, lower(r.status) AS status, r.created_at
           FROM refunds r
           LEFT JOIN businesses b ON b.id = r.business_id
          WHERE lower(r.status) IN ('pending', 'processing')
            AND r.created_at < (now() AT TIME ZONE 'UTC') - interval '48 hours'
          ORDER BY r.created_at ASC
          LIMIT ${ATTENTION_LIMIT}`,
      ),
      queryRows<Record<string, unknown>>(
        `SELECT id, kind, amount::float8 AS amount, lower(status) AS status, reference,
                balance_deducted, balance_reversed, created_at
           FROM admin_transfers
          WHERE lower(status) NOT IN ('success', 'completed', 'failed', 'reversed', 'cancelled')
             OR (balance_deducted AND NOT coalesce(balance_reversed, false) AND lower(status) IN ('failed', 'reversed'))
          ORDER BY created_at ASC
          LIMIT ${ATTENTION_LIMIT}`,
      ),
      queryRows<Record<string, unknown>>(
        `SELECT o.id, o.business_id, b.name AS business_name, o.total_amount::float8 AS amount,
                o.payment_status, coalesce(o.paid_at, o.created_at) AS paid_at
           FROM orders o
           LEFT JOIN businesses b ON b.id = o.business_id
          WHERE o.payment_status IN ('paid', 'completed')
            AND NOT EXISTS (
              SELECT 1 FROM transactions t WHERE t.order_id = o.id AND t.transaction_type = 'payment'
            )
          ORDER BY coalesce(o.paid_at, o.created_at) DESC
          LIMIT ${ATTENTION_LIMIT}`,
      ),
      queryRows<Record<string, unknown>>(
        `WITH payments AS (
            SELECT business_id, coalesce(sum(amount) FILTER (WHERE transaction_type = 'payment' AND status = 'completed'), 0) AS paid_in
              FROM transactions
             GROUP BY business_id
         ), withdrawn AS (
            SELECT business_id, coalesce(sum(amount), 0) AS withdrawn
              FROM withdrawals
             WHERE lower(status::text) IN ('success', 'completed', 'processed')
             GROUP BY business_id
         ), refunded AS (
            SELECT business_id, coalesce(sum(refund_amount), 0) AS refunded
              FROM refunds
             WHERE lower(status) = 'processed'
             GROUP BY business_id
         ), compared AS (
           SELECT b.id, b.name,
                  (coalesce(b.available_balance, 0) + coalesce(b.pending_balance, 0))::float8 AS actual,
                  (coalesce(p.paid_in, 0) - coalesce(w.withdrawn, 0) - coalesce(r.refunded, 0))::float8 AS expected
             FROM businesses b
             LEFT JOIN payments p ON p.business_id = b.id
             LEFT JOIN withdrawn w ON w.business_id = b.id
             LEFT JOIN refunded r ON r.business_id = b.id
         )
         SELECT id, name, actual, expected, (actual - expected)::float8 AS gap
           FROM compared
          WHERE abs(actual - expected) > 1
          ORDER BY abs(actual - expected) DESC
          LIMIT ${ATTENTION_LIMIT}`,
      ),
      // Pending-balance invariant (read-only). Stored pending_balance must equal the
      // net of every transaction that is still pending in the pending bucket, using
      // exactly the arithmetic fb_settle_due_transactions applies when it settles:
      // GREATEST(0, amount - refunds that are not failed/rejected).
      queryRows<Record<string, unknown>>(
        `WITH refunded AS (
            SELECT transaction_id, coalesce(sum(refund_amount), 0) AS refunded
              FROM refunds
             WHERE lower(status::text) NOT IN ('failed', 'rejected')
             GROUP BY transaction_id
         ), pending AS (
            SELECT t.business_id,
                   coalesce(sum(GREATEST(0, t.amount - coalesce(rf.refunded, 0))), 0) AS derived
              FROM transactions t
              LEFT JOIN refunded rf ON rf.transaction_id = t.id
             WHERE t.settlement_status::text = 'pending'
               AND t.balance_bucket = 'pending'
             GROUP BY t.business_id
         )
         SELECT b.id, b.name,
                coalesce(b.pending_balance, 0)::float8 AS stored,
                coalesce(p.derived, 0)::float8 AS derived,
                (coalesce(b.pending_balance, 0) - coalesce(p.derived, 0))::float8 AS gap
           FROM businesses b
           LEFT JOIN pending p ON p.business_id = b.id
          WHERE abs(coalesce(b.pending_balance, 0) - coalesce(p.derived, 0)) > 0.01
          ORDER BY abs(coalesce(b.pending_balance, 0) - coalesce(p.derived, 0)) DESC
          LIMIT ${ATTENTION_LIMIT}`,
      ),
      // Refunds that pushed a transaction past the money it actually took. Read-only;
      // legacy rows are reported, never adjusted.
      queryRows<Record<string, unknown>>(
        `SELECT r.transaction_id, min(r.order_id) AS order_id, r.business_id,
                b.name AS business_name,
                t.amount::float8 AS transaction_amount,
                sum(r.refund_amount)::float8 AS refunded,
                count(*)::int AS refund_count
           FROM refunds r
           JOIN transactions t ON t.id = r.transaction_id
           LEFT JOIN businesses b ON b.id = r.business_id
          WHERE lower(r.status::text) NOT IN ('failed', 'rejected')
          GROUP BY r.transaction_id, r.business_id, b.name, t.amount
         HAVING sum(r.refund_amount) > t.amount
          ORDER BY (sum(r.refund_amount) - t.amount) DESC
          LIMIT ${ATTENTION_LIMIT}`,
      ),
    ])

  const anomalyItems: AttentionItem[] = []
  for (const business of negativeBalances) {
    const balance = round2(num(business.available_balance) + num(business.pending_balance))
    anomalyItems.push({
      id: `negative_balance:${business.id}`,
      kind: 'negative_balance',
      title: String(business.name ?? 'Business'),
      detail: 'Balance is negative',
      amount: balance,
      status: 'deficit',
      created_at: null,
      href: `/admin/businesses/${business.id}`,
      business_id: String(business.id),
      resolvable: false,
      severity: 'danger',
    })
  }
  for (const entry of reconciliation) {
    const actual = round2(num(entry.actual))
    const expected = round2(num(entry.expected))
    const gap = round2(actual - expected)
    if (negativeBalances.some((business) => String(business.id) === String(entry.id))) continue
    anomalyItems.push({
      id: `unreconciled:${entry.id}`,
      kind: 'unreconciled_balance',
      title: String(entry.name ?? 'Business'),
      detail: `Stored balance ₦${actual.toLocaleString('en-NG')} does not match ledger ₦${expected.toLocaleString('en-NG')}`,
      amount: gap,
      status: 'unreconciled',
      created_at: null,
      href: `/admin/businesses/${entry.id}`,
      business_id: String(entry.id),
      resolvable: false,
      severity: 'warning',
    })
  }
  for (const entry of pendingDrift) {
    if (negativeBalances.some((business) => String(business.id) === String(entry.id))) continue
    const stored = round2(num(entry.stored))
    const derived = round2(num(entry.derived))
    anomalyItems.push({
      id: `pending_drift:${entry.id}`,
      kind: 'pending_balance_drift',
      title: String(entry.name ?? 'Business'),
      detail: `Stored pending balance ₦${stored.toLocaleString('en-NG')} does not match the ₦${derived.toLocaleString('en-NG')} still awaiting settlement`,
      amount: round2(stored - derived),
      status: 'pending_drift',
      created_at: null,
      href: `/admin/businesses/${entry.id}`,
      business_id: String(entry.id),
      resolvable: false,
      severity: 'warning',
    })
  }
  for (const entry of overRefunded) {
    const refunded = round2(num(entry.refunded))
    const paid = round2(num(entry.transaction_amount))
    anomalyItems.push({
      id: `over_refunded:${entry.transaction_id}`,
      kind: 'over_refunded',
      title: String(entry.business_name ?? 'Business'),
      detail: `Refunds of ₦${refunded.toLocaleString('en-NG')} exceed the ₦${paid.toLocaleString('en-NG')} payment on order ${String(entry.order_id ?? '')}`,
      amount: round2(refunded - paid),
      status: 'over_refunded',
      created_at: null,
      href: entry.order_id ? `/admin/transactions/${entry.order_id}` : '/admin/transactions',
      business_id: entry.business_id ? String(entry.business_id) : null,
      order_id: entry.order_id ? String(entry.order_id) : null,
      resolvable: false,
      severity: 'danger',
    })
  }
  for (const entry of anomalies) {
    const details = entry.details as Record<string, unknown> | null
    const orderId = details && typeof details.order_id === 'string' ? details.order_id : null
    anomalyItems.push({
      id: String(entry.id),
      kind: 'payment_anomaly',
      title: String(entry.kind ?? 'Payment anomaly').replace(/_/g, ' '),
      detail: entry.reference ? `Reference ${entry.reference}` : 'Payment provider reported an inconsistency',
      amount: null,
      status: 'unresolved',
      created_at: entry.created_at ? new Date(String(entry.created_at)).toISOString() : null,
      href: orderId ? `/admin/transactions/${orderId}` : null,
      order_id: orderId,
      resolvable: true,
      severity: 'warning',
    })
  }

  const stuckWithdrawalItems: AttentionItem[] = stuckWithdrawals.map((entry) => ({
    id: String(entry.id),
    kind: 'stuck_withdrawal',
    title: String(entry.business_name ?? 'Business'),
    detail: `Withdrawal ${String(entry.status ?? '').replace(/_/g, ' ')} for over 30 minutes`,
    amount: round2(num(entry.amount)),
    status: String(entry.status ?? 'pending'),
    created_at: entry.created_at ? new Date(String(entry.created_at)).toISOString() : null,
    href: '/admin/withdrawals',
    business_id: entry.business_id ? String(entry.business_id) : null,
    resolvable: false,
    severity: 'warning',
  }))

  const stuckRefundItems: AttentionItem[] = stuckRefunds.map((entry) => ({
    id: String(entry.id),
    kind: 'stuck_refund',
    title: String(entry.business_name ?? 'Refund'),
    detail: `Refund ${String(entry.status ?? '').replace(/_/g, ' ')} for over 48 hours`,
    amount: round2(num(entry.amount)),
    status: String(entry.status ?? 'pending'),
    created_at: entry.created_at ? new Date(String(entry.created_at)).toISOString() : null,
    href: entry.order_id ? `/admin/transactions/${entry.order_id}` : '/admin/transactions',
    business_id: entry.business_id ? String(entry.business_id) : null,
    order_id: entry.order_id ? String(entry.order_id) : null,
    resolvable: false,
    severity: 'warning',
  }))

  const transferItems: AttentionItem[] = pendingTransfers.map((entry) => {
    const needsReversal = Boolean(entry.balance_deducted) && !Boolean(entry.balance_reversed)
    const status = String(entry.status ?? 'pending')
    const terminalFailure = ['failed', 'reversed'].includes(status)
    return {
      id: String(entry.id),
      kind: 'admin_transfer',
      title: entry.kind === 'sms_funding' ? 'SMS wallet funding' : 'Platform withdrawal',
      detail: terminalFailure
        ? 'Transfer failed after the balance was deducted and has not been reversed'
        : `Transfer ${status.replace(/_/g, ' ')} since ${entry.created_at ? new Date(String(entry.created_at)).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }) : 'earlier'}`,
      amount: round2(num(entry.amount)),
      status,
      created_at: entry.created_at ? new Date(String(entry.created_at)).toISOString() : null,
      href: entry.kind === 'sms_funding' ? '/admin' : '/admin/withdrawals',
      resolvable: false,
      severity: needsReversal && terminalFailure ? 'danger' : 'warning',
    }
  })

  const paidWithoutTransactionItems: AttentionItem[] = paidWithoutTransaction.map((entry) => ({
    id: String(entry.id),
    kind: 'paid_without_transaction',
    title: String(entry.business_name ?? 'Business'),
    detail: 'Order is marked paid but has no payment transaction',
    amount: round2(num(entry.amount)),
    status: String(entry.payment_status ?? 'paid'),
    created_at: entry.paid_at ? new Date(String(entry.paid_at)).toISOString() : null,
    href: `/admin/transactions/${entry.id}`,
    business_id: entry.business_id ? String(entry.business_id) : null,
    order_id: String(entry.id),
    resolvable: false,
    severity: 'danger',
  }))

  const counts: AttentionCounts = {
    anomalies: anomalyItems.length,
    stuckWithdrawals: stuckWithdrawalItems.length,
    stuckRefunds: stuckRefundItems.length,
    pendingTransfers: transferItems.length,
    paidWithoutTransaction: paidWithoutTransactionItems.length,
  }

  return {
    ...counts,
    total: counts.anomalies + counts.stuckWithdrawals + counts.stuckRefunds + counts.pendingTransfers + counts.paidWithoutTransaction,
    rows: includeRows
      ? {
          anomalies: anomalyItems.slice(0, ATTENTION_LIMIT),
          stuckWithdrawals: stuckWithdrawalItems,
          stuckRefunds: stuckRefundItems,
          pendingTransfers: transferItems,
          paidWithoutTransaction: paidWithoutTransactionItems,
        }
      : {
          anomalies: [],
          stuckWithdrawals: [],
          stuckRefunds: [],
          pendingTransfers: [],
          paidWithoutTransaction: [],
        },
    generatedAt: new Date().toISOString(),
  }
}

/* -------------------------------------------------------------------------- */
/* Business performance                                                       */
/* -------------------------------------------------------------------------- */

export interface BusinessPerformanceRow {
  id: string
  name: string
  slug: string | null
  is_active: boolean
  paid_orders: number
  volume: number
  service_fees: number
  refunds: number
  refund_count: number
  refund_rate: number | null
  withdrawn: number
  withdrawal_count: number
  available_balance: number
  pending_balance: number
  balance: number
  deficit: boolean
  last_paid_at: string | null
}

/**
 * Per-business paid volume, fees, refunds and withdrawals for a period, plus the
 * current stored balance. Uses grouped CTEs so refunds and withdrawals can never
 * multiply the payment rows (a plain join would inflate the volume).
 */
export async function getBusinessPerformance(period: AdminPeriod): Promise<BusinessPerformanceRow[]> {
  const [start, end] = periodSqlParams(period)
  const result = await queryRows<Record<string, unknown>>(
    `WITH paid AS (
        SELECT o.business_id,
               count(*)::int AS paid_orders,
               coalesce(sum(o.total_amount), 0)::float8 AS volume,
               coalesce(sum(o.service_fee_amount), 0)::float8 AS service_fees,
               max(coalesce(o.paid_at, o.created_at)) AS last_paid_at
          FROM orders o
         WHERE ${PAID_ORDER_CONDITION} AND ${naiveRange('coalesce(o.paid_at, o.created_at)')}
         GROUP BY o.business_id
     ), refunded AS (
        SELECT business_id,
               count(*)::int AS refund_count,
               coalesce(sum(refund_amount), 0)::float8 AS refund_amount
          FROM refunds
         WHERE lower(status) = 'processed' AND ${naiveRange('coalesce(processed_at, created_at)')}
         GROUP BY business_id
     ), withdrawn AS (
        SELECT business_id,
               count(*)::int AS withdrawal_count,
               coalesce(sum(amount), 0)::float8 AS withdrawn
          FROM withdrawals
         WHERE lower(status::text) IN ('success', 'completed', 'processed')
           AND ${naiveRange('coalesce(processed_at, created_at)')}
         GROUP BY business_id
     )
     SELECT b.id, b.name, b.slug, b.is_active,
            coalesce(b.available_balance, 0)::float8 AS available_balance,
            coalesce(b.pending_balance, 0)::float8 AS pending_balance,
            coalesce(p.paid_orders, 0)::int AS paid_orders,
            coalesce(p.volume, 0)::float8 AS volume,
            coalesce(p.service_fees, 0)::float8 AS service_fees,
            p.last_paid_at,
            coalesce(r.refund_count, 0)::int AS refund_count,
            coalesce(r.refund_amount, 0)::float8 AS refund_amount,
            coalesce(w.withdrawal_count, 0)::int AS withdrawal_count,
            coalesce(w.withdrawn, 0)::float8 AS withdrawn
       FROM businesses b
       LEFT JOIN paid p ON p.business_id = b.id
       LEFT JOIN refunded r ON r.business_id = b.id
       LEFT JOIN withdrawn w ON w.business_id = b.id
      ORDER BY coalesce(p.volume, 0) DESC, b.name ASC`,
    [start, end],
  )

  return result.map((row) => {
    const volume = round2(num(row.volume))
    const refundAmount = round2(num(row.refund_amount))
    const balance = round2(num(row.available_balance) + num(row.pending_balance))
    return {
      id: String(row.id),
      name: String(row.name ?? 'Business'),
      slug: row.slug === null || row.slug === undefined ? null : String(row.slug),
      is_active: Boolean(row.is_active),
      paid_orders: num(row.paid_orders),
      volume,
      service_fees: round2(num(row.service_fees)),
      refunds: refundAmount,
      refund_count: num(row.refund_count),
      refund_rate: volume > 0 ? round2((refundAmount / volume) * 100) : null,
      withdrawn: round2(num(row.withdrawn)),
      withdrawal_count: num(row.withdrawal_count),
      available_balance: round2(num(row.available_balance)),
      pending_balance: round2(num(row.pending_balance)),
      balance,
      deficit: balance < 0,
      last_paid_at: row.last_paid_at ? new Date(String(row.last_paid_at)).toISOString() : null,
    }
  })
}
