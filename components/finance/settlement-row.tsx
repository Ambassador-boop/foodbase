import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

import { NGN } from '@/components/finance/money'
import {
  RefundBadge,
  RefundedAmount,
  SettlementBadge,
  refundStateOf,
  settlementStateOf,
} from '@/components/finance/settlement-status'
import { formatWat } from '@/lib/wat'

export interface SettlementRowData {
  transaction_id?: string
  order_id: string
  customer_first_name?: string | null
  received?: number
  refunded?: number
  refunded_before?: number
  refunded_after?: number
  settled: number
  state?: 'settled' | 'partly_refunded' | 'fully_refunded' | string
  refunds?: Array<{ id: string; amount: number; status: string }>
  created_at?: string | null
  paid_at?: string | null
}

export function settlementBadgeState(row: SettlementRowData) {
  return settlementStateOf({
    status: 'settled',
    settled: Number(row.settled || 0),
    refundedBefore: Number(row.refunded_before ?? row.refunded ?? 0),
    refundedAfter: Number(row.refunded_after ?? 0),
  })
}

export function settlementRefundState(row: SettlementRowData) {
  const statuses = (row.refunds ?? []).map((refund) => refund.status)
  if (statuses.length) return refundStateOf(statuses)
  return Number(row.refunded_before ?? row.refunded ?? 0) > 0
    ? ('processed' as const)
    : ('none' as const)
}

/**
 * Compact settlement line used on narrow screens: order, customer, the three
 * money figures and an explicit status. Refunds are always neutral with a
 * minus sign, never green.
 */
export function SettlementRow({
  row,
  settlementDate,
}: {
  row: SettlementRowData
  settlementDate?: string
}) {
  const refundedBefore = Number(row.refunded_before ?? row.refunded ?? 0)
  const refundState = settlementRefundState(row)

  return (
    <Link
      href={`/dashboard/finance/transaction/${row.order_id}`}
      className="flex items-center gap-3 border-b border-border py-3.5 transition-colors last:border-0 hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">Order {String(row.order_id).slice(0, 8).toUpperCase()}</p>
          <SettlementBadge state={settlementBadgeState(row)} className="md:hidden" />
        </div>
        <p className="truncate text-xs text-muted-foreground">
          {row.customer_first_name || 'Customer'}
          {row.paid_at
            ? ` · paid ${formatWat(row.paid_at, { hour: '2-digit', minute: '2-digit', hour12: true })}`
            : ''}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
          <span>
            Received <span className="num text-foreground">{NGN(Number(row.received ?? row.settled))}</span>
          </span>
          <span>
            Refunded <RefundedAmount value={refundedBefore} className="text-foreground" />
          </span>
          <span>
            Net <span className="num font-medium text-foreground">{NGN(Number(row.settled || 0))}</span>
          </span>
          {refundState !== 'none' && refundState !== 'processed' && (
            <RefundBadge state={refundState} amount={refundedBefore} />
          )}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  )
}
