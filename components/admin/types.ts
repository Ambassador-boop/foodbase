import type { SerialisedPeriod } from '@/lib/admin-period'

export interface PeriodMeta extends SerialisedPeriod {}

export interface RevenueComponents {
  serviceFees: number
  withdrawalFees: number
  paystackFees: number
  paystackFeesRecordedPayments: number
  paymentsWithTransaction: number
  paystackFeesMissing: number
  smsSpend: number
  net: number
  incomplete: boolean
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

export interface AttentionCounts {
  anomalies: number
  stuckWithdrawals: number
  stuckRefunds: number
  pendingTransfers: number
  paidWithoutTransaction: number
}

export interface Funnel {
  created: number
  paid: number
  failed: number
  abandoned: number
  inProgress: number
  conversionRate: number | null
}

export interface OverviewResponse {
  period: PeriodMeta
  previousPeriod: PeriodMeta | null
  generatedAt: string
  attention: number
  overview: {
    netRevenue: number
    paymentsVolume: number
    paidOrders: number
    averageOrder: number
    businesses: number
    daily: DailyPoint[]
    topBusinesses: Array<{ id: string; name: string; volume: number; paidOrders: number; serviceFees: number }>
    paystackBalance: number | null
    owedToBusinesses: number
    availableRevenue: number
    difference: number | null
    attentionCounts: AttentionCounts
    attention: number
    revenue: RevenueComponents
    revenueComparison: RevenueComponents | null
    paymentsVolumePrevious: number | null
    paidOrdersPrevious: number | null
    averageOrderPrevious: number | null
    totalBusinesses: number
    activeBusinesses: number
    newBusinesses: number
    businessesOwed: number
    funnel: Funnel
    refunds: {
      count: number
      amount: number
      rate: number | null
      failedCount: number
      failedAmount: number
      pendingCount: number
      pendingAmount: number
    }
    refundsPrevious: { count: number; amount: number } | null
    withdrawals: {
      byStatus: Array<{ status: string; count: number; amount: number; fee: number }>
      successCount: number
      successAmount: number
      feeRevenue: number
      pendingCount: number
      pendingAmount: number
      failedCount: number
      failedAmount: number
    }
    settlement: {
      pendingAmount: number
      pendingCount: number
      settledAmount: number
      settledCount: number
      nextRunAt: string | null
    }
    solvency: {
      paystackBalance: number | null
      paystackBalanceAsOf: string
      paystackBalanceStale: boolean
      paystackBalanceError: string | null
      owedToBusinesses: number
      totalDeficits: number
      deficitCount: number
      deficits: Array<{ id: string; name: string; balance: number }>
      adminAvailableRevenue: number
      difference: number | null
      covered: boolean | null
      unknown: string[]
    }
    platformRevenue: {
      totalRevenue: number
      withdrawnAmount: number
      availableBalance: number
      updatedAt: string | null
    }
    businessBalances: { availableTotal: number; pendingTotal: number }
    sms: { spend: number; transfers: number; pendingTransfers: number }
  }
}

export interface BusinessPerformanceResponse {
  period: PeriodMeta
  businesses: Array<{
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
  }>
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

export interface AttentionResponse {
  anomalies: number
  stuckWithdrawals: number
  stuckRefunds: number
  pendingTransfers: number
  paidWithoutTransaction: number
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

export interface RevenueResponse {
  period: PeriodMeta
  previousPeriod: PeriodMeta | null
  summary: { total_revenue: number; withdrawn_amount: number; available_balance: number; updated_at: string }
  components: {
    serviceFees: number
    withdrawalFees: number
    paystackFees: number
    paystackFeesRecordedPayments: number
    paymentsWithTransaction: number
    smsSpend: number
    paymentsVolume: number
    paidOrders: number
    net: number
  }
  previousComponents: { serviceFees: number; withdrawalFees: number; paystackFees: number; smsSpend: number; net: number } | null
  dailyBreakdown: Array<{ date: string; transaction_count: number; daily_revenue: number }>
  topRestaurants: Array<{ id: string; name: string; transaction_count: number; restaurant_revenue: number }>
  recentTransactions: Array<{
    id: string
    order_id: string
    service_fee_amount: number
    service_fee_type: string
    created_at: string
    business_name: string
    total_amount: number
  }>
  withdrawals: {
    byStatus: Array<{ status: string; count: number; amount: number; fee: number }>
    successAmount: number
    successCount: number
    feeRevenue: number
  }
}

export interface TransactionsResponse {
  period: PeriodMeta
  transactions: Array<{
    id: string
    order_id: string
    business_id: string
    business_name: string
    customer_name: string | null
    customer_email: string | null
    total_amount: number
    total: number
    service_fee_amount: number
    provider_fee: number | null
    net_received: number
    refunded: number
    payment_status: string | null
    status: string | null
    settlement_status: string | null
    created_at: string | null
  }>
  pagination: { page: number; limit: number; total: number; hasMore: boolean; totalPages: number }
}

export interface FeeTransactionsResponse {
  period: PeriodMeta
  transactions: Array<{
    id: string
    order_id: string | null
    amount: number
    transaction_type: string
    fee_type: string | null
    created_at: string | null
    occurred_at: string | null
    total_amount: number | null
    customer_name: string | null
    order_status: string | null
    business_id: string
    business_name: string
  }>
  pagination: { page: number; limit: number; total: number; totalPages: number }
}

export type SmsFundingStatus = 'pending' | 'otp' | 'success' | 'failed' | 'reversed' | string

export interface SmsFundingRecord {
  id: string
  amount: number
  status: SmsFundingStatus
  createdAt: string
  failureReason: string | null
}

export interface SmsWalletResponse {
  /** Live KudiSMS wallet figure. Null whenever the provider lookup failed. */
  balance: number | null
  balanceAvailable: boolean
  balanceUnavailable: boolean
  balanceStale: boolean
  balanceUpdatedAt: string | null
  lastKnownBalance: number | null
  lowThreshold: number
  isLow: boolean
  minFunding: number
  vatRate: number
  pendingWindowMinutes: number
  funding: {
    configured: boolean
    bankName?: string
    bankCode?: string
    accountNumberMasked?: string
    accountName?: string
    error?: string
  }
  setup: {
    configured: boolean
    accountNumber: { set: boolean; valid: boolean; masked: string | null }
    expectedName: { set: boolean; masked: string | null }
    resolved: { ok: boolean; masked: string | null; bankName: string | null; error: string | null }
    nameMatches: 'match' | 'mismatch' | 'not_configured' | 'unresolved'
  }
  adminAvailable: number
  lastFundedAt: string | null
  recent: SmsFundingRecord[]
  inFlight: SmsFundingRecord | null
  generatedAt: string
}
