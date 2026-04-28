import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { verifyJWT } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Try to get token from Authorization header first, then from cookie
    let token = request.headers.get('authorization')?.replace('Bearer ', '')

    if (!token) {
      // Get from cookie header
      token = request.cookies.get('auth_token')?.value
    }

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyJWT(token)

    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { rows } = await sql.query(
      'SELECT id, name, email, phone, slug, logo_url, cover_image_url, address FROM businesses WHERE owner_id = $1 ORDER BY created_at DESC',
      [payload.userId]
    )

    return NextResponse.json({ businesses: rows })
  } catch (error) {
    console.error('[v0] Businesses fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
