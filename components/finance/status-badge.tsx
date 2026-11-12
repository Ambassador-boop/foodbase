import { Badge } from '@/components/ui/badge'
import { SettlementBadge } from '@/components/finance/settlement-status'
import { settlementStateOf } from '@/components/finance/settlement-status'

type Variant = 'success' | 'warning' | 'danger' | 'neutral' | 'settled' | 'info'

/**
 * Generic status pill for the finance feed (income, withdrawals, refunds).
 * Settlement strings are routed to the dedicated settlement variant so a
 * settlement row can never be rendered with the green credit colour.
 */
export function StatusBadge({
  status,
  children,
  variant: requested,
}: {
  status: string
  children?: React.ReactNode
  variant?: Variant
}) {
  const key = String(status ?? '')
    .toLowerCase()
    .replace(/[_\s]/g, '-')

  const label = (() => {
    if (key === 'settlement' || key === 'settled') return 'Settled'
    if (['success', 'processed', 'completed'].includes(key)) return 'Completed'
    if (
      [
        'pending',
        'processing',
        'queued',
        'otp',
        'received',
        'needs-attention',
        'requested',
      ].includes(key)
    )
      return 'Pending'
    if (['failed', 'rejected', 'abandoned', 'blocked', 'reversed'].includes(key))
      return 'Failed'
    return 'Pending'
  })()

  const isSettlement = key === 'settlement' || key === 'settled'
  const variant: Variant =
    requested ??
    (isSettlement
      ? 'settled'
      : label === 'Failed'
        ? 'danger'
        : label === 'Pending'
          ? 'warning'
          : 'success')

  return <Badge variant={variant}>{children || label}</Badge>
}

/**
 * Settlement badge derived from the money itself so the pill can never
 * contradict the amount shown beside it.
 */
export function SettlementStatusBadge({
  status,
  settled,
  refundedBefore,
  refundedAfter,
}: {
  status?: string | null
  settled: number
  refundedBefore?: number
  refundedAfter?: number
}) {
  return (
    <SettlementBadge
      state={settlementStateOf({ status, settled, refundedBefore, refundedAfter })}
    />
  )
}
