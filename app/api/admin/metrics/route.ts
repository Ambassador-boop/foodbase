import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { queryRow } from '@/lib/admin-analytics'

export const dynamic = 'force-dynamic'

/**
 * Small summary used by the admin shell. Revenue here is the payments volume of
 * paid orders, matching the overview, not the sum of every transaction row.
 */
export async function GET(request: NextRequest) {
  try {
    const token = await getTokenFromRequest(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const verified = await verifyToken(token)
    if (verified?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const summary = await queryRow<Record<string, unknown>>(
      `SELECT
          (SELECT count(*)::int FROM businesses WHERE is_active = true) AS total_businesses,
          (SELECT count(*)::int FROM orders) AS total_orders,
          (SELECT coalesce(sum(total_amount), 0)::float8 FROM orders WHERE payment_status IN ('paid', 'completed')) AS total_revenue,
          (SELECT count(*)::int FROM users) AS total_users`,
    )

    return NextResponse.json({
      totalBusinesses: Number(summary?.total_businesses ?? 0),
      totalOrders: Number(summary?.total_orders ?? 0),
      totalRevenue: Number(summary?.total_revenue ?? 0),
      totalUsers: Number(summary?.total_users ?? 0),
    })
  } catch (error) {
    console.error('[admin] metrics failed', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
