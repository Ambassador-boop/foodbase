import Link from 'next/link'
import {
  AlertTriangle,
  ArrowDownToLine,
  BadgeCheck,
  CalendarDays,
  Info,
  RotateCcw,
  Undo2,
} from 'lucide-react'

import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { NGN } from '@/components/finance/money'
import { formatNaira } from '@/lib/finance'
import { SettlementRow } from '@/components/finance/settlement-row'
import { settlementBadgeState } from '@/components/finance/settlement-row'
import {
  RefundBadge,
  RefundedAmount,
  SettlementBadge,
  refundStateOf,
} from '@/components/finance/settlement-status'
import { formatWat } from '@/lib/wat'

export interface StatementRefund {
  id: string
  amount: number
  status: string
  created_at?: string | null
  processed_at?: string | null
}

export interface StatementRow {
  transaction_id: string
  order_id: string
  customer_first_name: string | null
  received: number
  refunded: number
  refunded_before?: number
  refunded_after?: number
  settled: number
  state: string
  refund_state?: string
  paid_at?: string | null
  created_at?: string | null
  refunds: StatementRefund[]
}

export interface StatementSummary {
  orders: number
  gross: number
  refunded: number
  refunded_before?: number
  refunded_after?: number
  expected_net?: number
  difference?: number
  reconciles?: boolean
  settled: number
  settled_at: string | null
}

export interface Statement {
  settlement_date: string
  summary: StatementSummary
  settlements: StatementRow[]
  refunds_after_settlement?: Array<{
    order_id: string
    customer_first_name: string | null
    amount: number
    refunds: StatementRefund[]
  }>
}

const orderRef = (value: string) => String(value || '').slice(0, 8).toUpperCase()

const paidLabel = (row: StatementRow) =>
  row.paid_at
    ? formatWat(row.paid_at, { hour: '2-digit', minute: '2-digit', hour12: true })
    : '—'

export function settledTimeLabel(value: string | null | undefined) {
  if (!value) return null
  return formatWat(value, { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** Gross − refunds − net, surfaced only when the statement does not balance. */
export function ReconciliationNote({ summary }: { summary: StatementSummary }) {
  const expectedNet = Number(summary.expected_net ?? summary.gross - (summary.refunded_before ?? summary.refunded))
  const difference = Number(summary.difference ?? summary.settled - expectedNet)
  const balanced = summary.reconciles ?? Math.abs(difference) < 0.005

  if (balanced) {
    return (
      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
        <BadgeCheck className="mt-px size-3.5 shrink-0" aria-hidden="true" />
        Gross received minus refunds before settlement equals the amount recorded as
        settled.
      </p>
    )
  }

  return (
    <p
      className="flex items-start gap-1.5 rounded-lg bg-[var(--warning-bg)] px-2.5 py-2 text-[11px] font-medium text-[var(--warning)]"
      role="status"
    >
      <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>
        Does not reconcile, contact support. The amounts differ by{' '}
        <span className="num">{NGN(Math.abs(difference))}</span> from the settlement
        record.
      </span>
    </p>
  )
}

export function StatementSummaryCard({ summary }: { summary: StatementSummary }) {
  const orders = Number(summary.orders || 0)
  const settledAt = settledTimeLabel(summary.settled_at)
  const refundedBefore = Number(summary.refunded_before ?? summary.refunded ?? 0)

  return (
    <Card className="gap-0 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Net settled to your available balance
          </p>
          <p className="mt-1.5 text-3xl font-semibold num md:text-4xl">
            {NGN(Number(summary.settled || 0))}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {orders} {orders === 1 ? 'order' : 'orders'}
            {settledAt ? ` · settled at ${settledAt} WAT` : ''}
          </p>
        </div>
        <SettlementBadge state="settled" />
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 md:max-w-md">
        <div>
          <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <ArrowDownToLine className="size-3.5 shrink-0" aria-hidden="true" />
            Gross received
          </dt>
          <dd className="mt-0.5 text-base font-medium num">
            {NGN(Number(summary.gross || 0))}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <Undo2 className="size-3.5 shrink-0" aria-hidden="true" />
            Refunded before settlement
          </dt>
          <dd className="mt-0.5 text-base font-medium num">
            <RefundedAmount value={refundedBefore} placeholder={formatNaira(0)} />
          </dd>
        </div>
      </dl>

      <div className="mt-3">
        <ReconciliationNote summary={summary} />
      </div>
    </Card>
  )
}

function RefundStateCell({ row }: { row: StatementRow }) {
  const statuses = (row.refunds ?? []).map((refund) => refund.status)
  const state = statuses.length
    ? refundStateOf(statuses)
    : Number(row.refunded_before ?? row.refunded ?? 0) > 0
      ? ('processed' as const)
      : ('none' as const)

  if (state === 'none' || state === 'processed') return null
  return <RefundBadge state={state} amount={Number(row.refunded_before ?? row.refunded ?? 0)} />
}

export function StatementTable({ rows }: { rows: StatementRow[] }) {
  return (
    <div className="hidden overflow-hidden rounded-2xl border border-border bg-card md:block">
      <div className="max-h-[36rem] overflow-y-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Orders settled on this day</caption>
          <thead className="sticky top-0 z-10 bg-card">
            <tr className="border-b border-border text-[11px] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className="px-4 py-3 text-left font-medium">Order</th>
              <th scope="col" className="px-4 py-3 text-left font-medium">Customer</th>
              <th scope="col" className="px-4 py-3 text-left font-medium">Time paid</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Received</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Refunded</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Net settled</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.transaction_id}-${row.order_id}`}
                className="border-b border-border/70 transition-colors last:border-0 hover:bg-muted/40"
              >
                <td className="px-4 py-3">
                  <Link
                    href={`/dashboard/finance/transaction/${row.order_id}`}
                    className="font-medium underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
                  >
                    {orderRef(row.order_id)}
                  </Link>
                </td>
                <td className="max-w-[12rem] truncate px-4 py-3 text-muted-foreground">
                  {row.customer_first_name || 'Customer'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                  {paidLabel(row)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right num">
                  {NGN(Number(row.received || 0))}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right num">
                  <RefundedAmount value={Number(row.refunded_before ?? row.refunded ?? 0)} className="text-foreground" />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold num">
                  {NGN(Number(row.settled || 0))}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col items-end gap-1">
                    <SettlementBadge state={settlementBadgeState(row)} />
                    <RefundStateCell row={row} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function StatementCards({ rows }: { rows: StatementRow[] }) {
  return (
    <Card className="gap-0 p-3 md:hidden">
      {rows.map((row) => (
        <SettlementRow key={`${row.transaction_id}-${row.order_id}`} row={row} />
      ))}
    </Card>
  )
}

export function RefundedAfterSettlement({
  rows,
}: {
  rows: NonNullable<Statement['refunds_after_settlement']>
}) {
  if (!rows.length) return null
  const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)

  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <RotateCcw className="size-4 text-[var(--settle)]" aria-hidden="true" />
            Refunded after settlement
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            These refunds ran after this settlement, so they came out of your available
            balance. They are not part of the figures above.
          </p>
        </div>
        <p className="shrink-0 text-sm font-semibold num">
          <RefundedAmount value={total} className="text-foreground" />
        </p>
      </div>

      <Card className="gap-0 divide-y divide-border p-2">
        {rows.map((row) => {
          const state = refundStateOf((row.refunds ?? []).map((refund) => refund.status))
          const first = row.refunds?.[0]
          return (
            <Link
              key={`${row.order_id}-after`}
              href={`/dashboard/finance/transaction/${row.order_id}`}
              className="flex items-center gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">Order {orderRef(row.order_id)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {row.customer_first_name || 'Customer'}
                  {first?.processed_at
                    ? ` · refunded ${formatWat(first.processed_at, {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })} WAT`
                    : ''}
                </p>
              </div>
              <RefundBadge state={state} amount={Number(row.amount || 0)} />
            </Link>
          )
        })}
      </Card>
    </section>
  )
}

export function ScheduleNote() {
  return (
    <Card className="flex-row items-start gap-2 p-4 text-[13px] text-muted-foreground">
      <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>
        Payments Monday to Thursday settle the next day at 5:00 AM WAT. Payments Friday
        to Sunday settle on Monday at 5:00 AM WAT.
      </p>
    </Card>
  )
}

export function StatementEmpty() {
  return (
    <Card className="items-center gap-2 p-8 text-center">
      <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--settle-bg)] text-[var(--settle)]">
        <CalendarDays className="size-5" aria-hidden="true" />
      </span>
      <p className="text-sm font-medium">No settlement on this date</p>
      <p className="max-w-sm text-xs text-muted-foreground">
        Nothing was due to move into your available balance on this day. Pick another
        settlement from your finance feed.
      </p>
      <Link
        href="/dashboard/finance"
        className="mt-2 text-xs font-medium text-primary underline-offset-4 hover:underline"
      >
        Back to finance
      </Link>
    </Card>
  )
}

export function StatementError({
  onRetry,
  message,
}: {
  onRetry: () => void
  message?: string
}) {
  return (
    <Card className="items-start gap-3 p-5">
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--warning)]" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">This statement could not be loaded</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {message || 'Check your connection and try again. Your balances are unaffected.'}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <RotateCcw className="size-4" aria-hidden="true" />
          Retry
        </button>
        <Link
          href="/dashboard/finance"
          className="inline-flex h-9 items-center rounded-xl border border-border px-3 text-sm hover:bg-muted/50"
        >
          Back to finance
        </Link>
      </div>
    </Card>
  )
}

export function StatementSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading settlement statement…</span>
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="hidden overflow-hidden rounded-2xl border border-border md:block">
        <div className="flex items-center gap-4 border-b border-border bg-muted/30 px-4 py-3">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-20" />
          <Skeleton className="ml-auto h-3 w-16" />
          <Skeleton className="h-3 w-16" />
        </div>
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-center gap-4 border-b border-border/60 px-4 py-3.5 last:border-0">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="ml-auto h-4 w-16" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-2 md:hidden">
        {[0, 1, 2].map((card) => (
          <Skeleton key={card} className="h-24 w-full rounded-2xl" />
        ))}
      </div>
    </div>
  )
}
