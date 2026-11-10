import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { periodSqlParams, resolveAdminPeriod, serialisePeriod } from '@/lib/admin-period'
import { getWithdrawalSummary, num, round2 } from '@/lib/admin-analytics'

export const dynamic = 'force-dynamic'

const STATUS_GROUPS: Record<string, string[]> = {
  pending: ['pending', 'processing', 'otp', 'received', 'queued', 'approved'],
  success: ['success', 'completed', 'processed'],
  failed: ['failed', 'rejected', 'abandoned', 'blocked', 'reversed'],
}

/**
 * Read-only view of business payout requests for the admin console.
 * The money-moving endpoints stay where they were: business withdrawals are
 * requested by businesses, and platform revenue withdrawals live in
 * /api/admin/withdrawals. Nothing here writes.
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
    const status = (params.get('status') || 'all').toLowerCase()
    const search = (params.get('search') || '').trim()
    const period = resolveAdminPeriod({ range: params.get('range'), from: params.get('from'), to: params.get('to') })
    const [start, end] = periodSqlParams(period)

    const statuses = STATUS_GROUPS[status] ?? null
    const result: any = await query(
      `SELECT w.id, w.business_id, b.name AS business_name,
              w.amount::float8 AS amount,
              w.net_amount::float8 AS net_amount,
              coalesce(w.withdrawal_fee, w.service_fee, 0)::float8 AS withdrawal_fee,
              w.bank_account_holder, w.bank_account_number, w.bank_code,
              lower(w.status::text) AS status,
              w.paystack_transfer_id,
              w.created_at, w.requested_at, w.processed_at,
              count(*) OVER()::int AS total_count
         FROM withdrawals w
         LEFT JOIN businesses b ON b.id = w.business_id
        WHERE ($1::timestamptz IS NULL OR coalesce(w.processed_at, w.created_at) >= $1::timestamptz AT TIME ZONE 'UTC')
          AND coalesce(w.processed_at, w.created_at) < $2::timestamptz AT TIME ZONE 'UTC'
          AND ($3::text[] IS NULL OR lower(w.status::text) = ANY($3::text[]))
          AND ($4 = '' OR b.name ILIKE '%' || $4 || '%' OR w.bank_account_holder ILIKE '%' || $4 || '%'
               OR w.bank_account_number ILIKE '%' || $4 || '%' OR w.id ILIKE '%' || $4 || '%')
        ORDER BY w.created_at DESC
        LIMIT $5 OFFSET $6`,
      [start, end, statuses, search, limit, offset],
    )

    const rows = (Array.isArray(result) ? result : result?.rows ?? []) as Record<string, unknown>[]
    const total = rows.length > 0 ? num(rows[0].total_count) : 0
    const summary = await getWithdrawalSummary(period)

    const withdrawals = rows.map((row) => ({
      id: String(row.id),
      business_id: row.business_id ? String(row.business_id) : null,
      business_name: row.business_name ?? 'Business',
      amount: round2(num(row.amount)),
      net_amount: round2(num(row.net_amount)),
      withdrawal_fee: round2(num(row.withdrawal_fee)),
      bank_account_holder: row.bank_account_holder ?? null,
      bank_account_number: row.bank_account_number ?? null,
      bank_code: row.bank_code ?? null,
      status: String(row.status ?? 'pending'),
      paystack_transfer_id: row.paystack_transfer_id ?? null,
      created_at: row.created_at ? new Date(String(row.created_at)).toISOString() : null,
      processed_at: row.processed_at ? new Date(String(row.processed_at)).toISOString() : null,
    }))

    return NextResponse.json({
      period: serialisePeriod(period),
      summary,
      withdrawals,
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    })
  } catch (error) {
    console.error('[admin] payouts view failed', error)
    return NextResponse.json({ error: 'Failed to load withdrawals' }, { status: 500 })
  }
}
