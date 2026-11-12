import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'
import { getAttentionQueue } from '@/lib/admin-analytics'

export const dynamic = 'force-dynamic'

async function requireAdmin(request: NextRequest) {
  const token = await getTokenFromRequest(request)
  const user = token ? await verifyToken(token) : null
  if (!user || user.role !== 'admin') return null
  return user
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireAdmin(request)
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const countsOnly = request.nextUrl.searchParams.get('countsOnly') === '1'
    const queue = await getAttentionQueue({ includeRows: !countsOnly })

    // Batch 3A: self-registrations from the last 7 days. A separate count, so the
    // financial alert total and every existing badge stay exactly as they are.
    let newRegistrations = 0
    try {
      const rows: any = await query(
        "SELECT COUNT(*)::int AS n FROM businesses WHERE created_at >= NOW() - INTERVAL '7 days'",
      )
      const row = Array.isArray(rows) ? rows[0] : rows?.rows?.[0]
      newRegistrations = Number(row?.n ?? 0)
    } catch (countError) {
      console.error('[admin] registration count failed', countError)
    }
    return NextResponse.json({
      ...queue,
      counts: {
        anomalies: queue.anomalies,
        stuckWithdrawals: queue.stuckWithdrawals,
        stuckRefunds: queue.stuckRefunds,
        pendingTransfers: queue.pendingTransfers,
        paidWithoutTransaction: queue.paidWithoutTransaction,
        newRegistrations,
      },
    })
  } catch (error) {
    console.error('[admin] attention queue failed', error)
    return NextResponse.json({ error: 'Failed to load alerts' }, { status: 500 })
  }
}

/**
 * Resolves a payment anomaly reported by the payment provider. Everything else in
 * the queue is cleared by fixing the underlying record, so it is read-only here.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAdmin(request)
    if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await request.json().catch(() => ({}))
    const kind = typeof body?.kind === 'string' ? body.kind : ''
    const id = typeof body?.id === 'string' ? body.id : ''
    const note = typeof body?.note === 'string' ? body.note.slice(0, 500) : ''

    if (kind !== 'payment_anomaly' || !id) {
      return NextResponse.json(
        { error: 'This alert clears itself once the underlying record is fixed.' },
        { status: 400 },
      )
    }

    const updated = await query(
      `UPDATE payment_anomalies
          SET resolved = true,
              resolved_at = now(),
              resolved_by = $2,
              resolved_note = $3
        WHERE id = $1 AND coalesce(resolved, false) = false
        RETURNING id`,
      [id, String((user as any).id ?? (user as any).userId ?? ''), note || null],
    )
    const updatedRows = Array.isArray(updated) ? updated : (updated as any)?.rows ?? []
    if (updatedRows.length === 0) {
      return NextResponse.json({ error: 'Alert not found or already resolved' }, { status: 404 })
    }
    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error('[admin] attention resolve failed', error)
    return NextResponse.json({ error: 'Failed to update alert' }, { status: 500 })
  }
}
