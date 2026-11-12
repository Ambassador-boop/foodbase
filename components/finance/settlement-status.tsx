import type { LucideIcon } from 'lucide-react'
import {
  BadgeCheck,
  Clock3,
  RotateCcw,
  Timer,
  Undo2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatNaira } from '@/lib/finance'

/**
 * Settlement + refund vocabulary for the restaurant dashboard.
 *
 * Money a business already earned moves between two of its own pockets when it
 * settles, so settlement is never coloured green (credit) or red (debit).
 * Colour is also never the only signal: every state carries a label and an
 * icon, which is what screen readers and colour-blind users rely on.
 */

export type SettlementState =
  | 'awaiting'
  | 'settled'
  | 'settled_partly_refunded'
  | 'settled_fully_refunded'
  | 'refund_in_progress'
  | 'refund_failed'

/** Refund lifecycle, independent of whether the transaction has settled. */
export type RefundState = 'none' | 'in_progress' | 'processed' | 'failed' | 'mixed'

type BadgeVariant = 'warning' | 'settled' | 'neutral' | 'info'

export const SETTLEMENT_LABEL: Record<SettlementState, string> = {
  awaiting: 'Awaiting settlement',
  settled: 'Settled',
  settled_partly_refunded: 'Settled, partly refunded',
  settled_fully_refunded: 'Settled, fully refunded',
  refund_in_progress: 'Refund in progress',
  refund_failed: 'Refund failed, returned to your balance',
}

const SETTLEMENT_VARIANT: Record<SettlementState, BadgeVariant> = {
  awaiting: 'warning',
  settled: 'settled',
  settled_partly_refunded: 'neutral',
  settled_fully_refunded: 'neutral',
  refund_in_progress: 'info',
  refund_failed: 'neutral',
}

const SETTLEMENT_ICON: Record<SettlementState, LucideIcon> = {
  awaiting: Clock3,
  settled: BadgeCheck,
  settled_partly_refunded: Undo2,
  settled_fully_refunded: Undo2,
  refund_in_progress: Timer,
  refund_failed: RotateCcw,
}

const FAILED_REFUND_STATUSES = new Set(['failed', 'rejected'])
const IN_PROGRESS_REFUND_STATUSES = new Set([
  'pending',
  'processing',
  'requested',
  'queued',
  'otp',
  'received',
  'needs-attention',
  'needs_attention',
])
const PROCESSED_REFUND_STATUSES = new Set([
  'processed',
  'completed',
  'success',
  'refunded',
  'reversed',
])

export function isFailedRefund(status: unknown): boolean {
  return FAILED_REFUND_STATUSES.has(String(status ?? '').toLowerCase())
}

export function isRefundInProgress(status: unknown): boolean {
  return IN_PROGRESS_REFUND_STATUSES.has(String(status ?? '').toLowerCase())
}

export function isProcessedRefund(status: unknown): boolean {
  return PROCESSED_REFUND_STATUSES.has(String(status ?? '').toLowerCase())
}

/**
 * Collapses a list of refund statuses into a single visual state.
 * `failed` wins when nothing succeeded, `mixed` when some money left and some
 * attempts did not, so the row never overstates a refund.
 */
export function refundStateOf(statuses: Array<unknown>): RefundState {
  const list = statuses.map((s) => String(s ?? '').toLowerCase()).filter(Boolean)
  if (list.length === 0) return 'none'
  const failed = list.filter((s) => FAILED_REFUND_STATUSES.has(s)).length
  const inProgress = list.filter((s) => IN_PROGRESS_REFUND_STATUSES.has(s)).length
  const processed = list.filter((s) => PROCESSED_REFUND_STATUSES.has(s)).length
  // A refund still moving decides the row: the settlement figure is not final
  // while any amount is in flight, whatever else already completed.
  if (inProgress > 0) return 'in_progress'
  if (processed > 0 && failed > 0) return 'mixed'
  if (processed > 0) return 'processed'
  return 'failed'
}

/**
 * Derives the settlement badge from the money itself rather than from a
 * status string, so the badge can never contradict the amount beside it.
 */
export function settlementStateOf(input: {
  status?: string | null
  settled: number
  refundedBefore?: number
  refundedAfter?: number
}): SettlementState {
  const status = String(input.status ?? '').toLowerCase()
  const settled = Number(input.settled || 0)
  const refunded = Number(input.refundedBefore ?? 0) + Number(input.refundedAfter ?? 0)

  if (status === 'pending' || status === 'awaiting') {
    return 'awaiting'
  }
  if (settled <= 0 && refunded > 0) return 'settled_fully_refunded'
  if (refunded > 0) return 'settled_partly_refunded'
  return 'settled'
}

export function SettlementBadge({
  state,
  label,
  className,
}: {
  state: SettlementState
  label?: string
  className?: string
}) {
  const Icon = SETTLEMENT_ICON[state] ?? Clock3
  return (
    <Badge variant={SETTLEMENT_VARIANT[state]} className={cn('gap-1.5', className)}>
      <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
      <span className="truncate">{label ?? SETTLEMENT_LABEL[state]}</span>
    </Badge>
  )
}

/** Refund badge used inside settlement rows, where refunds are informational. */
export function RefundBadge({
  state,
  amount,
  className,
}: {
  state: RefundState
  amount?: number
  className?: string
}) {
  if (state === 'none') return null

  const copy: Record<Exclude<RefundState, 'none'>, string> = {
    in_progress: 'Refund in progress',
    processed: amount ? `Refunded −${formatNaira(amount)}` : 'Refunded',
    failed: 'Refund failed, returned to your balance',
    mixed: 'Refunded, one attempt failed',
  }

  const variant: BadgeVariant =
    state === 'in_progress' ? 'info' : state === 'processed' ? 'neutral' : 'neutral'
  const Icon = state === 'in_progress' ? Timer : state === 'failed' ? RotateCcw : Undo2

  return (
    <Badge variant={variant} className={cn('gap-1.5', className)}>
      <Icon className="size-3.5 shrink-0" strokeWidth={2} aria-hidden="true" />
      <span className="truncate">{copy[state]}</span>
    </Badge>
  )
}

/**
 * Money that left the business before settlement. Always neutral and always
 * signed with a minus so it can never be mistaken for a credit.
 */
export function RefundedAmount({
  value,
  className,
  placeholder = '—',
}: {
  value: number | null | undefined
  className?: string
  placeholder?: string
}) {
  const amount = Number(value || 0)
  if (!amount) {
    return (
      <span className={cn('num text-muted-foreground/70', className)}>{placeholder}</span>
    )
  }
  return (
    <span className={cn('num whitespace-nowrap', className)}>
      <span aria-hidden="true">−</span>
      <span className="sr-only">minus </span>
      {formatNaira(amount)}
    </span>
  )
}
