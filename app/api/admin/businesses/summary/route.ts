import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { resolveAdminPeriod, serialisePeriod } from '@/lib/admin-period'
import { getBusinessPerformance } from '@/lib/admin-analytics'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = await getTokenFromRequest(request)
    const user = token ? await verifyToken(token) : null
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const params = request.nextUrl.searchParams
    const period = resolveAdminPeriod({ range: params.get('range'), from: params.get('from'), to: params.get('to') })
    const businesses = await getBusinessPerformance(period)

    return NextResponse.json({ period: serialisePeriod(period), businesses })
  } catch (error) {
    console.error('[admin] business performance failed', error)
    return NextResponse.json({ error: 'Failed to fetch business performance' }, { status: 500 })
  }
}
