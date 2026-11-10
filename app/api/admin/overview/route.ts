import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { getOne } from '@/lib/db'
import { AdminPeriod, resolveAdminPeriod, serialisePeriod } from '@/lib/admin-period'
import {
  getAttentionQueue,
  getBusinessTotals,
  getDailySeries,
  getOrderFunnel,
  getPaidSummary,
  getRefundSummary,
  getSettlementSummary,
  getSmsSummary,
  getTopBusinesses,
  getWithdrawalSummary,
  num,
  round2,
} from '@/lib/admin-analytics'
import { getPaystackBalance } from '@/lib/paystack'

export const dynamic = 'force-dynamic'

/** The equal-length window immediately before `period`, or null for "all time". */
function previousWindow(period: AdminPeriod): AdminPeriod | null {
  if (!period.previousStart || !period.previousEnd) return null
  return { ...period, start: period.previousStart, end: period.previousEnd }
}

export interface RevenueComponents {
  serviceFees: number
  withdrawalFees: number
  paystackFees: number
  paystackFeesRecordedPayments: number
  paymentsWithTransaction: number
  paystackFeesMissing: number
  smsSpend: number
  net: number
  /** True when at least one Paystack fee is missing, so net revenue is a floor. */
  incomplete: boolean
}

export async function GET(request: NextRequest) {
  try {
    const token = await getTokenFromRequest(request)
    const user = token ? await verifyToken(token) : null
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const params = request.nextUrl.searchParams
    const period = resolveAdminPeriod({ range: params.get('range'), from: params.get('from'), to: params.get('to') })
    const previous = previousWindow(period)

    const [
      paid,
      previousPaid,
      funnel,
      withdrawals,
      previousWithdrawals,
      sms,
      previousSms,
      settlement,
      businessTotals,
      daily,
      topBusinesses,
      attention,
      paystack,
      platformRevenueRow,
    ] = await Promise.all([
      getPaidSummary(period),
      previous ? getPaidSummary(previous) : Promise.resolve(null),
      getOrderFunnel(period),
      getWithdrawalSummary(period),
      previous ? getWithdrawalSummary(previous) : Promise.resolve(null),
      getSmsSummary(period),
      previous ? getSmsSummary(previous) : Promise.resolve(null),
      getSettlementSummary(period),
      getBusinessTotals(period),
      getDailySeries(period),
      getTopBusinesses(period),
      getAttentionQueue({ includeRows: false }),
      getPaystackBalance(),
      getOne(
        'SELECT total_revenue, withdrawn_amount, available_balance, updated_at FROM admin_revenue ORDER BY updated_at DESC NULLS LAST LIMIT 1',
      ),
    ])

    const platformRevenue = platformRevenueRow as {
      total_revenue: number
      withdrawn_amount: number
      available_balance: number
      updated_at: string
    } | null

    const refunds = await getRefundSummary(period, paid.volume)
    const previousRefunds = previous ? await getRefundSummary(previous, previousPaid?.volume ?? 0) : null

    const revenue: RevenueComponents = {
      serviceFees: paid.serviceFees,
      withdrawalFees: withdrawals.feeRevenue,
      paystackFees: paid.paystackFees,
      paystackFeesRecordedPayments: paid.paystackFeePayments,
      paymentsWithTransaction: paid.paymentsWithTransaction,
      paystackFeesMissing: Math.max(0, paid.paymentsWithTransaction - paid.paystackFeePayments),
      smsSpend: sms.spend,
      net: round2(paid.serviceFees + withdrawals.feeRevenue - paid.paystackFees - sms.spend),
      incomplete: paid.paymentsWithTransaction > paid.paystackFeePayments,
    }

    const previousRevenue: RevenueComponents | null =
      previousPaid && previousWithdrawals && previousSms
        ? {
            serviceFees: previousPaid.serviceFees,
            withdrawalFees: previousWithdrawals.feeRevenue,
            paystackFees: previousPaid.paystackFees,
            paystackFeesRecordedPayments: previousPaid.paystackFeePayments,
            paymentsWithTransaction: previousPaid.paymentsWithTransaction,
            paystackFeesMissing: Math.max(0, previousPaid.paymentsWithTransaction - previousPaid.paystackFeePayments),
            smsSpend: previousSms.spend,
            net: round2(previousPaid.serviceFees + previousWithdrawals.feeRevenue - previousPaid.paystackFees - previousSms.spend),
            incomplete: previousPaid.paymentsWithTransaction > previousPaid.paystackFeePayments,
          }
        : null

    const averageOrder = paid.paidOrders > 0 ? round2(paid.volume / paid.paidOrders) : 0
    const previousAverageOrder =
      previousPaid && previousPaid.paidOrders > 0 ? round2(previousPaid.volume / previousPaid.paidOrders) : previousPaid ? 0 : null

    const adminAvailableRevenue = round2(num(platformRevenue?.available_balance))
    const owedToBusinesses = businessTotals.owed
    const difference = paystack.balance === null ? null : round2(paystack.balance - owedToBusinesses - adminAvailableRevenue)
    const solvencyUnknown: string[] = []
    if (paystack.balance === null) solvencyUnknown.push('paystackBalance')

    return NextResponse.json({
      period: serialisePeriod(period),
      previousPeriod: previous ? serialisePeriod(previous) : null,
      generatedAt: new Date().toISOString(),
      attention: attention.total,
      overview: {
        // Legacy keys kept for existing consumers.
        netRevenue: revenue.net,
        paymentsVolume: paid.volume,
        paidOrders: paid.paidOrders,
        averageOrder,
        businesses: businessTotals.active,
        daily,
        topBusinesses,
        paystackBalance: paystack.balance,
        owedToBusinesses,
        availableRevenue: adminAvailableRevenue,
        difference,
        attentionCounts: {
          anomalies: attention.anomalies,
          stuckWithdrawals: attention.stuckWithdrawals,
          stuckRefunds: attention.stuckRefunds,
          pendingTransfers: attention.pendingTransfers,
          paidWithoutTransaction: attention.paidWithoutTransaction,
        },
        attention: attention.total,
        revenue,

        // New detail.
        revenueComparison: previousRevenue,
        paymentsVolumePrevious: previousPaid ? previousPaid.volume : null,
        paidOrdersPrevious: previousPaid ? previousPaid.paidOrders : null,
        averageOrderPrevious: previousAverageOrder,
        totalBusinesses: businessTotals.total,
        activeBusinesses: businessTotals.active,
        newBusinesses: businessTotals.newInPeriod,
        businessesOwed: owedToBusinesses,
        funnel,
        refunds,
        refundsPrevious: previousRefunds ? { count: previousRefunds.count, amount: previousRefunds.amount } : null,
        withdrawals: {
          byStatus: withdrawals.byStatus,
          successCount: withdrawals.successCount,
          successAmount: withdrawals.successAmount,
          feeRevenue: withdrawals.feeRevenue,
          pendingCount: withdrawals.pendingCount,
          pendingAmount: withdrawals.pendingAmount,
          failedCount: withdrawals.failedCount,
          failedAmount: withdrawals.failedAmount,
        },
        settlement,
        solvency: {
          paystackBalance: paystack.balance,
          paystackBalanceAsOf: paystack.asOf,
          paystackBalanceStale: paystack.stale,
          paystackBalanceError: paystack.balance === null ? paystack.message ?? 'Paystack balance is unavailable' : null,
          owedToBusinesses,
          totalDeficits: Math.abs(businessTotals.deficitsTotal),
          deficitCount: businessTotals.deficitCount,
          deficits: businessTotals.deficits,
          adminAvailableRevenue,
          difference,
          covered: difference === null ? null : difference >= 0,
          unknown: solvencyUnknown,
        },
        platformRevenue: {
          totalRevenue: round2(num(platformRevenue?.total_revenue)),
          withdrawnAmount: round2(num(platformRevenue?.withdrawn_amount)),
          availableBalance: adminAvailableRevenue,
          updatedAt: platformRevenue?.updated_at ? new Date(platformRevenue.updated_at).toISOString() : null,
        },
        businessBalances: {
          availableTotal: businessTotals.availableTotal,
          pendingTotal: businessTotals.pendingTotal,
        },
        sms: { spend: sms.spend, transfers: sms.transfers, pendingTransfers: sms.pendingTransfers },
      },
    })
  } catch (error) {
    console.error('[admin] overview failed', error)
    return NextResponse.json({ error: 'Failed to fetch overview' }, { status: 500 })
  }
}
