import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'

const rangeDays: Record<string, number | null> = { today: 1, '7d': 7, '30d': 30, month: 31, all: null }

export async function GET(request: NextRequest) {
  try {
    const token = await getTokenFromRequest(request)
    const user = token ? await verifyToken(token) : null
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const range = request.nextUrl.searchParams.get('range') || '30d'
    const days = rangeDays[range] ?? 30
    const cutoff = days === null ? null : new Date(Date.now() - days * 86400000)
    const rows = await sql`
      SELECT b.id, b.name,
        COUNT(DISTINCT CASE WHEN LOWER(COALESCE(o.payment_status, '')) IN ('paid', 'success', 'completed') THEN o.id END)::int AS paid_orders,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(o.payment_status, '')) IN ('paid', 'success', 'completed') THEN o.total_amount ELSE 0 END), 0) AS volume,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(o.payment_status, '')) IN ('paid', 'success', 'completed') THEN o.service_fee_amount ELSE 0 END), 0) AS service_fees,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(o.payment_status, '')) IN ('paid', 'success', 'completed') THEN o.total_amount ELSE 0 END), 0) - COALESCE(SUM(CASE WHEN LOWER(COALESCE(o.payment_status, '')) IN ('paid', 'success', 'completed') THEN o.service_fee_amount ELSE 0 END), 0) AS balance,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(r.status::text, '')) IN ('completed', 'processed', 'success') THEN r.refund_amount ELSE 0 END), 0) AS refunds,
        COALESCE(SUM(CASE WHEN LOWER(COALESCE(w.status::text, '')) IN ('completed', 'processed', 'success') THEN w.amount ELSE 0 END), 0) AS withdrawn
      FROM businesses b
      LEFT JOIN orders o ON o.business_id = b.id AND (${cutoff}::timestamp IS NULL OR o.created_at >= ${cutoff})
      LEFT JOIN refunds r ON r.order_id = o.id
      LEFT JOIN withdrawals w ON w.business_id = b.id AND (${cutoff}::timestamp IS NULL OR w.created_at >= ${cutoff})
      GROUP BY b.id, b.name
      ORDER BY volume DESC, b.name ASC
    `
    return NextResponse.json({ businesses: rows.map((row: any) => ({ ...row, refund_rate: Number(row.volume) ? Number(row.refunds) / Number(row.volume) * 100 : 0 })) })
  } catch (error) {
    console.error('[v0] admin business performance failed', error)
    return NextResponse.json({ error: 'Failed to fetch business performance' }, { status: 500 })
  }
}
