import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'

/**
 * POST /api/admin/businesses/{businessId}/status   { is_active: boolean }
 *
 * Suspend / reactivate a restaurant using the existing `is_active` column.
 * This is not the delete path: nothing is removed, and the owner keeps their
 * data, menu and settlement history while suspended.
 *
 * Kept as its own route so the existing GET/PUT/DELETE handler for a business
 * is untouched.
 */

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest, { params }: { params: Promise<{ businessId: string }> }) {
  try {
    const token = await getTokenFromRequest(request)
    const admin = token ? await verifyToken(token) : null
    if (!admin || admin.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { businessId } = await params
    const body = await request.json().catch(() => ({}))
    if (typeof body?.is_active !== 'boolean') {
      return NextResponse.json({ error: 'Send is_active as true or false.' }, { status: 400 })
    }

    const rows: any = await query(
      'UPDATE businesses SET is_active = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, slug, is_active',
      [body.is_active, businessId],
    )
    const updated = Array.isArray(rows) ? rows[0] : rows?.rows?.[0]
    if (!updated) return NextResponse.json({ error: 'Business not found.' }, { status: 404 })

    return NextResponse.json({ success: true, business: updated })
  } catch (error) {
    console.error('[admin] business status change failed', error)
    return NextResponse.json({ error: 'Could not change the status.' }, { status: 500 })
  }
}
