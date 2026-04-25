import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { verifyJWT } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    let token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      token = request.cookies.get('auth_token')?.value
    }

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyJWT(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { businessId } = params

    const { rows } = await sql.query(
      'SELECT * FROM businesses WHERE id = $1 AND owner_id = $2',
      [businessId, payload.userId]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    return NextResponse.json({ business: rows[0] })
  } catch (error) {
    console.error('Business fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    let token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      token = request.cookies.get('auth_token')?.value
    }

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const payload = await verifyJWT(token)
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, email, phone, description, address, city, state, country, postal_code, logo_url } = body

    const { businessId } = params

    const { rows } = await sql.query(
      `UPDATE businesses 
       SET name = $1, email = $2, phone = $3, description = $4, address = $5, 
           city = $6, state = $7, country = $8, postal_code = $9, logo_url = $10, updated_at = NOW()
       WHERE id = $11 AND owner_id = $12 
       RETURNING *`,
      [name, email, phone, description, address, city, state, country, postal_code, logo_url, businessId, payload.userId]
    )

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Business not found or unauthorized' }, { status: 404 })
    }

    return NextResponse.json({ business: rows[0] })
  } catch (error) {
    console.error('Business update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
