import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { getOne, query } from '@/lib/db'
import { AdminPeriod, periodSqlParams, resolveAdminPeriod, serialisePeriod } from '@/lib/admin-period'
import { getPaidSummary, getRevenueReconciliation, getSmsSummary, getWithdrawalSummary, num, round2 } from '@/lib/admin-analytics'

export const dynamic = 'force-dynamic'

const PAID = "o.payment_status IN ('paid', 'completed')"

function previousWindow(period: AdminPeriod): AdminPeriod | null {
  if (!period.previousStart || !period.previousEnd) return null
  return { ...period, start: period.previousStart, end: period.previousEnd }
}

export async function GET(request: NextRequest) {
  try {
    const token = await getTokenFromRequest(request)
    const user = token ? await verifyToken(token) : null
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const params = request.nextUrl.searchParams
    const period = resolveAdminPeriod({ range: params.get('range'), from: params.get('from'), to: params.get('to') })
    const previous = previousWindow(period)
    const [start, end] = periodSqlParams(period)

    const [revenueRow, paid, previousPaid, withdrawals, previousWithdrawals, sms, dailyResult, topResult, recentResult] =
      await Promise.all([
        getOne(
          'SELECT total_revenue, withdrawn_amount, available_balance, updated_at FROM admin_revenue ORDER BY updated_at DESC NULLS LAST LIMIT 1',
        ),
        getPaidSummary(period),
        previous ? getPaidSummary(previous) : Promise.resolve(null),
        getWithdrawalSummary(period),
        previous ? getWithdrawalSummary(previous) : Promise.resolve(null),
        getSmsSummary(period),
        query(
          `SELECT ((coalesce(o.paid_at, o.created_at) + interval '1 hour')::date)::text AS date,
                  count(*)::int AS transaction_count,
                  coalesce(sum(o.service_fee_amount), 0)::float8 AS daily_revenue
             FROM orders o
            WHERE ${PAID}
              AND ($1::timestamptz IS NULL OR coalesce(o.paid_at, o.created_at) >= $1::timestamptz AT TIME ZONE 'UTC')
              AND coalesce(o.paid_at, o.created_at) < $2::timestamptz AT TIME ZONE 'UTC'
            GROUP BY 1
            ORDER BY 1 DESC
            LIMIT 120`,
          [start, end],
        ),
        query(
          `SELECT b.id, b.name,
                  count(*)::int AS transaction_count,
                  coalesce(sum(o.service_fee_amount), 0)::float8 AS restaurant_revenue
             FROM orders o
             JOIN businesses b ON b.id = o.business_id
            WHERE ${PAID}
              AND ($1::timestamptz IS NULL OR coalesce(o.paid_at, o.created_at) >= $1::timestamptz AT TIME ZONE 'UTC')
              AND coalesce(o.paid_at, o.created_at) < $2::timestamptz AT TIME ZONE 'UTC'
            GROUP BY b.id, b.name
            ORDER BY restaurant_revenue DESC
            LIMIT 10`,
          [start, end],
        ),
        query(
          `SELECT coalesce(osf.id, 'fee_' || o.id) AS id,
                  o.id AS order_id,
                  coalesce(osf.service_fee_amount, o.service_fee_amount, 0)::float8 AS service_fee_amount,
                  coalesce(osf.service_fee_type, 'tiered') AS service_fee_type,
                  coalesce(osf.created_at, o.paid_at, o.created_at) AS created_at,
                  b.name AS business_name,
                  o.total_amount::float8 AS total_amount
             FROM orders o
             JOIN businesses b ON b.id = o.business_id
             LEFT JOIN LATERAL (
               SELECT osf.id, osf.service_fee_amount, osf.service_fee_type, osf.created_at
                 FROM order_service_fees osf
                WHERE osf.order_id = o.id
                ORDER BY osf.created_at DESC
                LIMIT 1
             ) osf ON TRUE
            WHERE ${PAID}
            ORDER BY coalesce(osf.created_at, o.paid_at, o.created_at) DESC
            LIMIT 8`,
          [],
        ),
      ])

    const rowsOf = (value: any): Record<string, unknown>[] => (Array.isArray(value) ? value : value?.rows ?? [])

    // Read-only ledger check. Never allowed to break the revenue page: a failure
    // reports the card as unavailable instead of failing the whole response.
    const reconciliation = await getRevenueReconciliation(period).catch((error) => {
      console.error('[admin] reconciliation failed', error)
      return null
    })

    const components = {
      serviceFees: paid.serviceFees,
      withdrawalFees: withdrawals.feeRevenue,
      paystackFees: paid.paystackFees,
      paystackFeesRecordedPayments: paid.paystackFeePayments,
      paymentsWithTransaction: paid.paymentsWithTransaction,
      smsSpend: sms.spend,
      paymentsVolume: paid.volume,
      paidOrders: paid.paidOrders,
      // Added in 2e: the Paystack fee the platform paid to send successful payouts.
      payoutFees: withdrawals.payoutFees,
      payoutFeesRecordedWithdrawals: withdrawals.payoutFeesRecorded,
      net: round2(paid.serviceFees + withdrawals.feeRevenue - paid.paystackFees - sms.spend - withdrawals.payoutFees),
    }

    const previousComponents = previousPaid && previousWithdrawals
      ? {
          serviceFees: previousPaid.serviceFees,
          withdrawalFees: previousWithdrawals.feeRevenue,
          paystackFees: previousPaid.paystackFees,
          smsSpend: 0,
          payoutFees: previousWithdrawals.payoutFees,
          net: round2(previousPaid.serviceFees + previousWithdrawals.feeRevenue - previousPaid.paystackFees - previousWithdrawals.payoutFees),
        }
      : null

    const summary = revenueRow
      ? {
          total_revenue: round2(num(revenueRow.total_revenue)),
          withdrawn_amount: round2(num(revenueRow.withdrawn_amount)),
          available_balance: round2(num(revenueRow.available_balance)),
          updated_at: revenueRow.updated_at ? new Date(revenueRow.updated_at).toISOString() : new Date().toISOString(),
        }
      : { total_revenue: 0, withdrawn_amount: 0, available_balance: 0, updated_at: new Date().toISOString() }

    return NextResponse.json({
      period: serialisePeriod(period),
      previousPeriod: previous ? serialisePeriod(previous) : null,
      summary,
      components,
      previousComponents,
      dailyBreakdown: rowsOf(dailyResult),
      topRestaurants: rowsOf(topResult),
      recentTransactions: rowsOf(recentResult),
      reconciliation,
      withdrawals: {
        byStatus: withdrawals.byStatus,
        successAmount: withdrawals.successAmount,
        successCount: withdrawals.successCount,
        feeRevenue: withdrawals.feeRevenue,
      },
    })
  } catch (error) {
    console.error('[admin] revenue summary failed', error)
    return NextResponse.json({ error: 'Failed to load revenue' }, { status: 500 })
  }
}
