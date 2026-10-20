import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const token = await getTokenFromRequest(request)
  const user = token ? await verifyToken(token) : null
  if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const rows = await sql`
    SELECT b.name, COUNT(DISTINCT CASE WHEN LOWER(COALESCE(o.payment_status, '')) IN ('paid', 'success', 'completed') THEN o.id END)::int AS paid_orders,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(o.payment_status, '')) IN ('paid', 'success', 'completed') THEN o.total_amount ELSE 0 END), 0) AS volume,
      COALESCE(SUM(CASE WHEN LOWER(COALESCE(o.payment_status, '')) IN ('paid', 'success', 'completed') THEN o.service_fee_amount ELSE 0 END), 0) AS service_fees
    FROM businesses b LEFT JOIN orders o ON o.business_id = b.id GROUP BY b.id, b.name ORDER BY volume DESC
  `
  const csv = ['Business,Paid orders,Volume,Service fees', ...rows.map((row: any) => [JSON.stringify(row.name), row.paid_orders, row.volume, row.service_fees].join(','))].join('\n')
  return new NextResponse(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="business-performance.csv"' } })
}
