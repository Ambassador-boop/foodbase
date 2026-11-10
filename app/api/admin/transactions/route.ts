import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { periodSqlParams, resolveAdminPeriod, serialisePeriod } from '@/lib/admin-period'
import { num, round2 } from '@/lib/admin-analytics'

export const dynamic = 'force-dynamic'

const PAID = "o.payment_status IN ('paid', 'completed')"

/**
 * Paid orders for the finance transaction list. Reads orders, their fee and their
 * payment transaction in one query so nothing is loaded into memory and the totals
 * always match the overview.
 */
export async function GET(request: NextRequest) {
  try {
    const token = await getTokenFromRequest(request)
    const user = token ? await verifyToken(token) : null
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const params = request.nextUrl.searchParams
    const page = Math.max(1, num(params.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, num(params.get('limit')) || 25))
    const offset = (page - 1) * limit
    const search = (params.get('search') || '').trim()
    const status = (params.get('status') || 'all').toLowerCase()
    const period = resolveAdminPeriod({ range: params.get('range'), from: params.get('from'), to: params.get('to') })
    const [start, end] = periodSqlParams(period)

    const values: unknown[] = [start, end, search, status, limit, offset]
    const result: any = await query(
      `SELECT o.id,
              o.id AS order_id,
              o.business_id,
              b.name AS business_name,
              o.customer_name,
              o.customer_email,
              o.total_amount::float8 AS total_amount,
              o.service_fee_amount::float8 AS service_fee_amount,
              o.payment_status,
              o.status::text AS status,
              coalesce(o.paid_at, o.created_at) AS created_at,
              o.paid_at,
              tx.provider_fee::float8 AS provider_fee,
              tx.settlement_status,
              coalesce(rf.refunded, 0)::float8 AS refunded,
              count(*) OVER()::int AS total_count
         FROM orders o
         JOIN businesses b ON b.id = o.business_id
         LEFT JOIN LATERAL (
           SELECT t.provider_fee, t.settlement_status
             FROM transactions t
            WHERE t.order_id = o.id AND t.transaction_type = 'payment'
            ORDER BY t.created_at DESC
            LIMIT 1
         ) tx ON TRUE
         LEFT JOIN LATERAL (
           SELECT coalesce(sum(rf.refund_amount), 0)::float8 AS refunded
             FROM refunds rf
            WHERE rf.order_id = o.id AND lower(rf.status) = 'processed'
         ) rf ON TRUE
        WHERE ${PAID}
          AND ($1::timestamptz IS NULL OR coalesce(o.paid_at, o.created_at) >= $1::timestamptz AT TIME ZONE 'UTC')
          AND coalesce(o.paid_at, o.created_at) < $2::timestamptz AT TIME ZONE 'UTC'
          AND ($3 = '' OR b.name ILIKE '%' || $3 || '%' OR o.customer_name ILIKE '%' || $3 || '%'
               OR o.customer_email ILIKE '%' || $3 || '%' OR o.id ILIKE '%' || $3 || '%'
               OR o.payment_reference ILIKE '%' || $3 || '%')
          AND ($4 = 'all'
               OR ($4 = 'paid' AND o.payment_status = 'paid')
               OR ($4 = 'refunded' AND coalesce(rf.refunded, 0) > 0)
               OR ($4 = 'unsettled' AND coalesce(tx.settlement_status, 'pending') <> 'settled')
               OR ($4 = 'failed' AND lower(coalesce(tx.settlement_status, '')) = 'failed')
               OR lower(coalesce(o.payment_status, '')) = $4)
        ORDER BY coalesce(o.paid_at, o.created_at) DESC
        LIMIT $5 OFFSET $6`,
      values,
    )

    const rows = (Array.isArray(result) ? result : result?.rows ?? []) as Record<string, unknown>[]
    const total = rows.length > 0 ? num(rows[0].total_count) : 0

    const transactions = rows.map((row) => {
      const totalAmount = round2(num(row.total_amount))
      const serviceFee = round2(num(row.service_fee_amount))
      const providerFee = row.provider_fee === null ? null : round2(num(row.provider_fee))
      return {
        id: String(row.id),
        order_id: String(row.order_id),
        business_id: String(row.business_id),
        business_name: row.business_name ?? 'Business',
        customer_name: row.customer_name ?? null,
        customer_email: row.customer_email ?? null,
        total_amount: totalAmount,
        total: totalAmount,
        service_fee_amount: serviceFee,
        provider_fee: providerFee,
        net_received: round2(totalAmount - serviceFee),
        refunded: round2(num(row.refunded)),
        payment_status: row.payment_status ?? null,
        status: row.status ?? null,
        settlement_status: row.settlement_status ?? null,
        created_at: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
      }
    })

    return NextResponse.json({
      period: serialisePeriod(period),
      transactions,
      pagination: { page, limit, total, hasMore: page * limit < total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    })
  } catch (error) {
    console.error('[admin] transactions list failed', error)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}
