import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
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

    const [ordersResult, feesResult, withdrawalsResult, businessesResult, dailyResult] = await Promise.all([
      sql`SELECT id, total_amount, status, payment_status, created_at FROM orders ORDER BY created_at DESC`,
      sql`SELECT osf.order_id, osf.service_fee_amount, osf.created_at, o.total_amount, b.id AS business_id, b.name AS business_name FROM order_service_fees osf JOIN orders o ON o.id = osf.order_id JOIN businesses b ON b.id = o.business_id ORDER BY osf.created_at DESC`,
      sql`SELECT amount, withdrawal_fee, service_fee, status, created_at FROM withdrawals ORDER BY created_at DESC`,
      sql`SELECT COUNT(*)::int AS count FROM businesses WHERE is_active = true`,
      sql`SELECT DATE(osf.created_at) AS date, COALESCE(SUM(osf.service_fee_amount), 0) AS net FROM order_service_fees osf GROUP BY DATE(osf.created_at) ORDER BY date ASC`,
    ])

    const inRange = (value: string | Date) => !cutoff || new Date(value) >= cutoff
    const orders = ordersResult.rows.filter((row: any) => inRange(row.created_at))
    const fees = feesResult.rows.filter((row: any) => inRange(row.created_at))
    const withdrawals = withdrawalsResult.rows.filter((row: any) => inRange(row.created_at))
    const paidOrders = orders.filter((row: any) => String(row.payment_status || row.status).toLowerCase() === 'paid' || String(row.payment_status || '').toLowerCase() === 'success')
    const paymentsVolume = orders.reduce((sum: number, row: any) => sum + Number(row.total_amount || 0), 0)
    const serviceFees = fees.reduce((sum: number, row: any) => sum + Number(row.service_fee_amount || 0), 0)
    const withdrawalFees = withdrawals.reduce((sum: number, row: any) => sum + Number(row.withdrawal_fee || 0) + Number(row.service_fee || 0), 0)
    const averageOrder = orders.length ? paymentsVolume / orders.length : 0
    const byBusiness = new Map<string, { id: string; name: string; volume: number }>()
    for (const row of fees as any[]) {
      const current = byBusiness.get(row.business_id) || { id: row.business_id, name: row.business_name, volume: 0 }
      current.volume += Number(row.total_amount || 0)
      byBusiness.set(row.business_id, current)
    }
    const topBusinesses = [...byBusiness.values()].sort((a, b) => b.volume - a.volume).slice(0, 5)
    const daily = dailyResult.rows.filter((row: any) => inRange(row.date)).map((row: any) => ({ ...row, net: Number(row.net || 0) }))
    const netRevenue = serviceFees + withdrawalFees

    return NextResponse.json({ overview: {
      netRevenue, paymentsVolume, paidOrders: paidOrders.length, averageOrder,
      businesses: Number(businessesResult.rows[0]?.count || 0), daily, topBusinesses,
      paystackBalance: null, owedToBusinesses: 0, availableRevenue: netRevenue, difference: netRevenue,
      attentionCounts: {},
      revenue: { serviceFees, withdrawalFees, paystackFees: 0, smsSpend: 0, net: netRevenue },
    } })
  } catch (error) {
    console.error('[v0] admin overview failed', error)
    return NextResponse.json({ error: 'Failed to fetch overview' }, { status: 500 })
  }
}
