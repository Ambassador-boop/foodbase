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
      'SELECT id, email, first_name, last_name, phone, profile_picture_url FROM users WHERE id = $1',
      [user.id]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user: rows[0] })
  } catch (error) {
    console.error('[v0] Profile fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
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

    const body = await request.json()
    const { first_name, last_name, phone } = body

    const { rows } = await sql.query(
      'UPDATE users SET first_name = $1, last_name = $2, phone = $3, updated_at = NOW() WHERE id = $4 RETURNING id, email, first_name, last_name, phone, profile_picture_url',
      [first_name, last_name, phone, user.id]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user: rows[0] })
  } catch (error) {
    console.error('[v0] Profile update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
