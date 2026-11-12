/**
 * Public surface of the finance components.
 *
 * Every component that existed before the settlement redesign is still
 * exported from this module under the same name, so existing imports keep
 * working unchanged.
 */
export { NGN } from '@/components/finance/money'
export { StatusBadge, SettlementStatusBadge } from '@/components/finance/status-badge'
export { FinanceHero } from '@/components/finance/hero'
export { StatCard } from '@/components/finance/stat-card'
export { ActivityRow, DayGroup, FeedTabs, FeedSearch } from '@/components/finance/activity'
export type { ActivityKind } from '@/components/finance/activity'
export { PendingSettlementCard } from '@/components/finance/pending-settlements'
export type { PendingGroup, PendingOrder, PendingRefund } from '@/components/finance/pending-settlements'
export { SettlementRow, settlementBadgeState, settlementRefundState } from '@/components/finance/settlement-row'
export type { SettlementRowData } from '@/components/finance/settlement-row'
export {
  SettlementBadge,
  RefundBadge,
  RefundedAmount,
  settlementStateOf,
  refundStateOf,
  isFailedRefund,
  isRefundInProgress,
  isProcessedRefund,
  SETTLEMENT_LABEL,
} from '@/components/finance/settlement-status'
export type { SettlementState, RefundState } from '@/components/finance/settlement-status'
