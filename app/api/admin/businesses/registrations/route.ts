import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { query } from '@/lib/db'

/**
 * GET /api/admin/businesses/registrations
 *
 * Newest-first list of self-registered restaurants, for the admin businesses
 * area. Read-only: adding a business stays in the existing register flow.
 *
 * `email_verified` lives in an additive column, so the query degrades to NULL
 * when the Batch 3A SQL has not run. Nothing else depends on it.
 */

export const dynamic = 'force-dynamic'

async function requireAdmin(request: NextRequest) {
  const token = await getTokenFromRequest(request)
  const user = token ? await verifyToken(token) : null
  if (!user || user.role !== 'admin') return null
  return user
}

function rowsOf<T>(raw: any): T[] {
  return Array.isArray(raw) ? raw : (raw?.rows ?? [])
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit') ?? 50), 1), 200)
    const offset = Math.max(Number(request.nextUrl.searchParams.get('offset') ?? 0), 0)
    const search = (request.nextUrl.searchParams.get('search') ?? '').trim()
    const filter = request.nextUrl.searchParams.get('filter') ?? 'all'

    const where: string[] = []
    const params: unknown[] = []
    if (search) {
      params.push(`%${search.toLowerCase()}%`)
      where.push(`(LOWER(b.name) LIKE $${params.length} OR LOWER(b.slug) LIKE $${params.length} OR LOWER(COALESCE(u.email, b.email, '')) LIKE $${params.length})`)
    }
    if (filter === 'suspended') where.push('b.is_active = false')
    if (filter === 'active') where.push('b.is_active = true')

    const clause = where.length ? `WHERE ${where.join(' AND ')}` : ''

    const baseSelect = `SELECT b.id, b.name, b.slug, b.email, b.phone, b.city, b.state,
                               b.created_at, b.is_active, b.logo_url,
                               u.id AS owner_id, u.first_name, u.last_name, u.phone AS owner_phone`

    const sqlWithVerification = `${baseSelect}, u.email_verified, u.email_verified_at
        FROM businesses b
        LEFT JOIN users u ON u.id = b.owner_id
        ${clause}
        ORDER BY b.created_at DESC
        LIMIT ${limit} OFFSET ${offset}`

    const sqlWithoutVerification = `${baseSelect}, NULL::boolean AS email_verified, NULL::timestamptz AS email_verified_at
        FROM businesses b
        LEFT JOIN users u ON u.id = b.owner_id
        ${clause}
        ORDER BY b.created_at DESC
        LIMIT ${limit} OFFSET ${offset}`

    let rows: any[]
    try {
      rows = rowsOf(await query(sqlWithVerification, params))
    } catch {
      rows = rowsOf(await query(sqlWithoutVerification, params))
    }

    return NextResponse.json({
      success: true,
      registrations: rows,
      has_more: rows.length === limit,
    })
  } catch (error) {
    console.error('[admin] registrations list failed', error)
    return NextResponse.json({ error: 'Could not load registrations.' }, { status: 500 })
  }
}
