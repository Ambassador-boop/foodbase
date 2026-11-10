import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { periodSqlParams, resolveAdminPeriod, serialisePeriod } from '@/lib/admin-period'
import { num } from '@/lib/admin-analytics'

export const dynamic = 'force-dynamic'

const PAID = "o.payment_status IN ('paid', 'completed')"

export async function GET(request: NextRequest) {
  try {
    const token = await getTokenFromRequest(request)
    const user = token ? await verifyToken(token) : null
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const searchParams = request.nextUrl.searchParams
    const page = Math.max(1, num(searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, num(searchParams.get('limit')) || 20))
    const offset = (page - 1) * limit
    const period = resolveAdminPeriod({
      range: searchParams.get('range'),
      from: searchParams.get('from'),
      to: searchParams.get('to'),
    })
    const [start, end] = periodSqlParams(period)

    const result: any = await query(
      `WITH fee_rows AS (
          SELECT osf.id,
                 osf.order_id,
                 osf.service_fee_amount::float8 AS amount,
                 'service_fee'::text AS transaction_type,
                 osf.service_fee_type AS fee_type,
                 osf.created_at,
                 coalesce(o.paid_at, osf.created_at) AS occurred_at,
                 o.total_amount::float8 AS total_amount,
                 o.customer_name,
                 o.customer_email,
                 o.status::text AS order_status,
                 b.id AS business_id,
                 b.name AS business_name
            FROM order_service_fees osf
            JOIN orders o ON o.id = osf.order_id
            JOIN businesses b ON b.id = o.business_id
           WHERE ${PAID}
             AND ($1::timestamptz IS NULL OR coalesce(o.paid_at, osf.created_at) >= $1::timestamptz AT TIME ZONE 'UTC')
             AND coalesce(o.paid_at, osf.created_at) < $2::timestamptz AT TIME ZONE 'UTC'
          UNION ALL
          SELECT w.id,
                 NULL::varchar AS order_id,
                 w.withdrawal_fee::float8 AS amount,
                 'withdrawal_fee'::text AS transaction_type,
                 NULL::varchar AS fee_type,
                 w.created_at,
                 coalesce(w.processed_at, w.created_at) AS occurred_at,
                 NULL::float8 AS total_amount,
                 NULL::varchar AS customer_name,
                 NULL::varchar AS customer_email,
                 lower(w.status::text) AS order_status,
                 b.id AS business_id,
                 b.name AS business_name
            FROM withdrawals w
            JOIN businesses b ON b.id = w.business_id
           WHERE coalesce(w.withdrawal_fee, 0) > 0
             AND lower(w.status::text) IN ('success', 'completed', 'processed')
             AND ($1::timestamptz IS NULL OR coalesce(w.processed_at, w.created_at) >= $1::timestamptz AT TIME ZONE 'UTC')
             AND coalesce(w.processed_at, w.created_at) < $2::timestamptz AT TIME ZONE 'UTC'
       )
       SELECT *, count(*) OVER()::int AS total_count
         FROM fee_rows
        ORDER BY occurred_at DESC
        LIMIT $3 OFFSET $4`,
      [start, end, limit, offset],
    )
    const rows = (Array.isArray(result) ? result : result?.rows ?? []) as Record<string, unknown>[]

    const total = rows.length > 0 ? num(rows[0].total_count) : 0
    const transactions = rows.map((row) => ({
      ...row,
      amount: num(row.amount),
      total_amount: row.total_amount === null ? null : num(row.total_amount),
      created_at: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
      occurred_at: row.occurred_at ? new Date(String(row.occurred_at)).toISOString() : null,
    }))

    return NextResponse.json({
      period: serialisePeriod(period),
      transactions,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    })
  } catch (error) {
    console.error('[admin] revenue transactions failed', error)
    return NextResponse.json({ error: 'Failed to fetch revenue transactions' }, { status: 500 })
  }
}
