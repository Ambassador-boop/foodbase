import { NextRequest, NextResponse } from 'next/server'
import { getTokenFromRequest, verifyToken } from '@/lib/auth'
import { getOne } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Identity shown in the admin top bar. Admins only. */
export async function GET(request: NextRequest) {
  try {
    const token = await getTokenFromRequest(request)
    const payload = token ? await verifyToken(token) : null
    if (!payload || payload.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const user = await getOne(
      'SELECT id, email, first_name, last_name, role::text AS role FROM users WHERE id = $1',
      [String((payload as Record<string, unknown>).userId ?? '')],
    ) as { id: string; email: string; first_name: string | null; last_name: string | null; role: string } | null

    const name = [user?.first_name, user?.last_name].filter(Boolean).join(' ').trim()

    return NextResponse.json({
      userId: String((payload as Record<string, unknown>).userId ?? ''),
      email: user?.email ?? null,
      name: name || 'Platform admin',
      role: payload.role,
    })
  } catch (error) {
    console.error('[admin] me failed', error)
    return NextResponse.json({ error: 'Failed to load admin profile' }, { status: 500 })
  }
}
