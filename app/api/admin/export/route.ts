import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { periodSqlParams, resolveAdminPeriod } from '@/lib/admin-period'
import {
  getBusinessPerformance,
  getDailySeries,
  getPaidSummary,
  getSmsSummary,
  getWithdrawalSummary,
  num,
  round2,
} from '@/lib/admin-analytics'

export const dynamic = 'force-dynamic'

type Cell = string | number | null | undefined

function csvCell(value: Cell): string {
  if (value === null || value === undefined) return ''
  const text = String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function toCsv(header: string[], rows: Cell[][]): string {
  return [header.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\r\n')
}

function fileResponse(body: string, filename: string) {
  return new NextResponse(`\uFEFF${body}`, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}

const PAID = "o.payment_status IN ('paid', 'completed')"

export async function GET(request: NextRequest) {
  try {
    const token = await getTokenFromRequest(request)
    const user = token ? await verifyToken(token) : null
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const params = request.nextUrl.searchParams
    const type = (params.get('type') || 'businesses').toLowerCase()
    const period = resolveAdminPeriod({ range: params.get('range'), from: params.get('from'), to: params.get('to') })
    const stamp = `${period.start ? period.start.toISOString().slice(0, 10) : 'all-time'}_to_${period.end.toISOString().slice(0, 10)}`

    if (type === 'transactions') {
      const [start, end] = periodSqlParams(period)
      const result: any = await query(
        `SELECT o.id, b.name AS business_name, o.customer_name, o.customer_email,
                coalesce(o.paid_at, o.created_at) AS paid_at, o.total_amount::float8 AS total_amount,
                o.service_fee_amount::float8 AS service_fee_amount, tx.provider_fee::float8 AS provider_fee,
                tx.settlement_status, coalesce(rf.refunded, 0)::float8 AS refunded, o.payment_reference
           FROM orders o
           JOIN businesses b ON b.id = o.business_id
           LEFT JOIN LATERAL (
             SELECT t.provider_fee, t.settlement_status FROM transactions t
              WHERE t.order_id = o.id AND t.transaction_type = 'payment'
              ORDER BY t.created_at DESC LIMIT 1
           ) tx ON TRUE
           LEFT JOIN LATERAL (
             SELECT coalesce(sum(r.refund_amount), 0)::float8 AS refunded FROM refunds r
              WHERE r.order_id = o.id AND lower(r.status) = 'processed'
           ) rf ON TRUE
          WHERE ${PAID}
            AND ($1::timestamptz IS NULL OR coalesce(o.paid_at, o.created_at) >= $1::timestamptz AT TIME ZONE 'UTC')
            AND coalesce(o.paid_at, o.created_at) < $2::timestamptz AT TIME ZONE 'UTC'
          ORDER BY coalesce(o.paid_at, o.created_at) DESC
          LIMIT 5000`,
        [start, end],
      )
      const rows = (Array.isArray(result) ? result : result?.rows ?? []) as Record<string, any>[]
      const body = toCsv(
        ['Order', 'Business', 'Customer', 'Email', 'Paid at (WAT)', 'Total', 'Service fee', 'Paystack fee', 'Net to business', 'Settlement', 'Refunded', 'Reference'],
        rows.map((row) => [
          row.id,
          row.business_name,
          row.customer_name,
          row.customer_email,
          row.paid_at ? new Date(row.paid_at).toISOString() : '',
          round2(num(row.total_amount)),
          round2(num(row.service_fee_amount)),
          row.provider_fee === null ? 'Not recorded' : round2(num(row.provider_fee)),
          round2(num(row.total_amount) - num(row.service_fee_amount)),
          row.settlement_status,
          round2(num(row.refunded)),
          row.payment_reference,
        ]),
      )
      return fileResponse(body, `foodbase-transactions-${stamp}.csv`)
    }

    if (type === 'revenue') {
      const [paid, withdrawals, sms, daily] = await Promise.all([
        getPaidSummary(period),
        getWithdrawalSummary(period),
        getSmsSummary(period),
        getDailySeries(period),
      ])
      const rows: Cell[][] = daily.map((day) => [
        day.date,
        day.paidOrders,
        day.volume,
        day.serviceFees,
        day.withdrawalFees,
        day.paystackFees,
        day.net,
        day.ordersCreated,
        day.ordersFailed,
      ])
      rows.push([])
      rows.push(['Period total', paid.paidOrders, paid.volume, paid.serviceFees, withdrawals.feeRevenue, paid.paystackFees, round2(paid.serviceFees + withdrawals.feeRevenue - paid.paystackFees - sms.spend), '', ''])
      rows.push(['Paystack fees recorded on', paid.paystackFeePayments, 'payments', 'Payments with a transaction', paid.paymentsWithTransaction, '', '', '', ''])
      const body = toCsv(
        ['Date (WAT)', 'Paid orders', 'Payments volume', 'Service fees', 'Withdrawal fees', 'Paystack fees', 'Net revenue', 'Orders created', 'Orders failed'],
        rows,
      )
      return fileResponse(body, `foodbase-revenue-${stamp}.csv`)
    }

    const businesses = await getBusinessPerformance(period)
    const body = toCsv(
      ['Business', 'Active', 'Paid orders', 'Payments volume', 'Service fees', 'Refunds', 'Refund rate %', 'Withdrawn', 'Available balance', 'Pending balance', 'Total balance', 'Deficit'],
      businesses.map((business) => [
        business.name,
        business.is_active ? 'Yes' : 'No',
        business.paid_orders,
        business.volume,
        business.service_fees,
        business.refunds,
        business.refund_rate === null ? '' : business.refund_rate,
        business.withdrawn,
        business.available_balance,
        business.pending_balance,
        business.balance,
        business.deficit ? 'Yes' : 'No',
      ]),
    )
    return fileResponse(body, `foodbase-businesses-${stamp}.csv`)
  } catch (error) {
    console.error('[admin] export failed', error)
    return NextResponse.json({ error: 'Failed to export data' }, { status: 500 })
  }
}
