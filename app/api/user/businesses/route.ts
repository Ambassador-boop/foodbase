import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { verifyToken, getAuthCookie } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Try to get token from Authorization header first, then from cookie
    let token = request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) {
      token = await getAuthCookie()
    }

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await verifyToken(token)

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { rows } = await sql.query(
      'SELECT id, name, email, phone, slug FROM businesses WHERE owner_id = $1 ORDER BY created_at DESC',
      [user.id]
    )

    return NextResponse.json({ businesses: rows })
  } catch (error) {
    console.error('[v0] Businesses fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
