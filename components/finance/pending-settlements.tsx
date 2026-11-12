import { CalendarClock, Landmark, Receipt } from 'lucide-react'
import Link from 'next/link'

import { Card } from '@/components/ui/card'
import { NGN } from '@/components/finance/money'
import {
  RefundBadge,
  RefundedAmount,
  refundStateOf,
} from '@/components/finance/settlement-status'

export interface PendingRefund {
  id?: string
  amount: number
  status: string
}

export interface PendingOrder {
  order_id: string
  transaction_id?: string
  customer_first_name?: string | null
  customer_name?: string | null
  amount: number
  available_at?: string | null
  refunded?: number
  refunded_processed?: number
  refunded_in_progress?: number
  refunded_failed?: number
  net_settling: number
  refunds?: PendingRefund[]
}

export interface PendingGroup {
  label: string
  gross?: number
  refunded?: number
  refundedInProgress?: number
  net?: number
  total?: number
  count?: number
  orders?: PendingOrder[]
}

const money = (value: number | null | undefined) => NGN(Number(value || 0))

function normaliseGroup(group: PendingGroup) {
  const orders = group.orders ?? []
  const gross = Number(group.gross ?? orders.reduce((sum, o) => sum + Number(o.amount || 0), 0))
  const refundedInProgress = Number(
    group.refundedInProgress ??
      orders.reduce((sum, o) => sum + Number(o.refunded_in_progress ?? 0), 0),
  )
  // Everything deducted from gross, including refunds the provider is still
  // processing, so gross − refunded = net settling exactly.
  const fromOrders = orders.reduce(
    (sum, o) =>
      sum +
      Number(o.refunded_processed ?? 0) +
      Number(o.refunded_in_progress ?? 0),
    0,
  )
  const refunded = orders.length
    ? Math.max(Number(group.refunded ?? 0), fromOrders)
    : Number(group.refunded ?? 0)
  const net = Number(
    group.net ??
      group.total ??
      orders.reduce((sum, o) => sum + Number(o.net_settling || 0), 0),
  )
  return {
    label: group.label,
    orders,
    gross,
    refunded,
    refundedInProgress,
    net,
    count: Number(group.count ?? orders.length),
  }
}

function orderRef(order: PendingOrder) {
  return String(order.order_id || '').slice(0, 8)
}

function orderName(order: PendingOrder) {
  return (
    order.customer_first_name ||
    String(order.customer_name || '').trim().split(/\s+/)[0] ||
    'Customer'
  )
}

function orderRefundState(order: PendingOrder) {
  const statuses = (order.refunds ?? []).map((refund) => refund.status)
  if (statuses.length) return refundStateOf(statuses)
  if (Number(order.refunded_in_progress || 0) > 0) return 'in_progress' as const
  if (Number(order.refunded || 0) > 0) return 'processed' as const
  return 'none' as const
}

function PendingOrderRow({ order }: { order: PendingOrder }) {
  const state = orderRefundState(order)
  const refundedAmount = Number(
    order.refunded ||
      Number(order.refunded_processed || 0) +
        Number(order.refunded_in_progress || 0),
  )

  return (
    <Link
      href={`/dashboard/finance/transaction/${order.order_id}`}
      className="block rounded-lg px-2 py-2 transition-colors hover:bg-white/70 focus-visible:bg-white/70 focus-visible:outline-none"
    >
      {/* Mobile: three key figures stay visible. */}
      <div className="md:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Order {orderRef(order)}</p>
            <p className="truncate text-[11px] text-muted-foreground">{orderName(order)}</p>
          </div>
          <p className="shrink-0 text-sm font-semibold num">{money(order.net_settling)}</p>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <span>
            Amount <span className="num text-foreground">{money(order.amount)}</span>
          </span>
          {refundedAmount > 0 && (
            <span>
              Refunded{' '}
              <RefundedAmount value={refundedAmount} className="text-foreground" />
            </span>
          )}
          {state !== 'none' && <RefundBadge state={state} amount={refundedAmount} />}
        </div>
      </div>

      {/* Desktop: aligned columns. */}
      <div className="hidden items-center gap-3 md:grid md:grid-cols-[minmax(0,1fr)_7rem_minmax(0,13rem)_7.5rem]">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">Order {orderRef(order)}</p>
          <p className="truncate text-xs text-muted-foreground">{orderName(order)}</p>
        </div>
        <p className="text-right text-sm num">{money(order.amount)}</p>
        <div className="min-w-0">
          {state === 'none' ? (
            <span className="text-xs text-muted-foreground">No refunds</span>
          ) : (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {refundedAmount > 0 && <RefundedAmount value={refundedAmount} />}
              <RefundBadge state={state} amount={refundedAmount} />
            </div>
          )}
        </div>
        <p className="text-right text-sm font-semibold num">{money(order.net_settling)}</p>
      </div>
    </Link>
  )
}

/**
 * "Awaiting settlement": every payment still sitting in the pending bucket,
 * grouped by the day it will settle, with refunds accounted for per order so
 * the owner can see what will actually land in their available balance.
 */
export function PendingSettlementCard({ groups }: { groups: PendingGroup[] }) {
  const normalised = groups.map(normaliseGroup).filter((group) => group.orders.length > 0 || group.net > 0)
  if (!normalised.length) return null

  const totals = normalised.reduce(
    (acc, group) => ({
      gross: acc.gross + group.gross,
      refunded: acc.refunded + group.refunded,
      refundedInProgress: acc.refundedInProgress + group.refundedInProgress,
      net: acc.net + group.net,
      orders: acc.orders + group.count,
    }),
    { gross: 0, refunded: 0, refundedInProgress: 0, net: 0, orders: 0 },
  )

  return (
    <Card className="gap-0 p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-[var(--warning-bg)] text-[var(--warning)]">
              <Landmark className="size-4" strokeWidth={1.8} aria-hidden="true" />
            </span>
            Awaiting settlement
          </h2>
          <p className="mt-1 max-w-prose text-xs text-muted-foreground">
            Payments that have not reached your available balance yet. Refunds are
            already held out of these amounts.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Settling
          </p>
          <p className="text-xl font-semibold num">{money(totals.net)}</p>
          <p className="text-[11px] text-muted-foreground">
            {totals.orders} {totals.orders === 1 ? 'order' : 'orders'}
          </p>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-muted/50 p-2.5 text-center">
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Gross</dt>
          <dd className="text-sm font-medium num">{money(totals.gross)}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Refunded</dt>
          <dd className="text-sm font-medium num">
            <RefundedAmount value={totals.refunded} />
          </dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-wide text-muted-foreground">Net settling</dt>
          <dd className="text-sm font-semibold num">{money(totals.net)}</dd>
        </div>
      </dl>

      {totals.refundedInProgress > 0 && (
        <p className="mt-2 text-[11px] text-[var(--info)]">
          Refunds worth {money(totals.refundedInProgress)} are still being processed.
          They are already deducted above and come back to your available balance if
          the provider declines them.
        </p>
      )}

      <div className="mt-3 space-y-2.5">
        {normalised.map((group) => (
          <section
            key={group.label}
            className="overflow-hidden rounded-xl border border-border bg-[var(--settle-bg)]"
          >
            <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-[var(--settle-border)] px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <CalendarClock
                  className="size-4 shrink-0 text-[var(--settle)]"
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
                <p className="truncate text-sm font-medium text-[var(--settle)]">
                  Settles {group.label}
                </p>
              </div>
              <p className="text-sm font-semibold num text-[var(--settle)]">{money(group.net)}</p>
            </header>

            <div className="flex flex-wrap gap-x-4 gap-y-0.5 bg-white/50 px-3 py-2 text-[11px] text-muted-foreground">
              <span>
                Gross <span className="num text-foreground">{money(group.gross)}</span>
              </span>
              <span>
                Refunded{' '}
                <RefundedAmount value={group.refunded} className="text-foreground" />
              </span>
              <span>
                Net settling <span className="num font-medium text-foreground">{money(group.net)}</span>
              </span>
              <span className="ml-auto inline-flex items-center gap-1">
                <Receipt className="size-3" aria-hidden="true" />
                {group.count} {group.count === 1 ? 'order' : 'orders'}
              </span>
            </div>

            <div className="divide-y divide-[var(--settle-border)]/60 px-1">
              {group.orders.map((order) => (
                <PendingOrderRow key={order.order_id} order={order} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Card>
  )
}
