import { NextRequest, NextResponse } from 'next/server'
import { Pool } from '@neondatabase/serverless'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    const userId = request.headers.get('x-user-id')
    const { businessId } = params

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await pool.query(
      'SELECT * FROM businesses WHERE id = $1 AND owner_id = $2',
      [businessId, userId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    return NextResponse.json({ business: result.rows[0] })
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
    const userId = request.headers.get('x-user-id')
    const { businessId } = params

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, email, phone, description, address, city, state, country, postal_code } = body

    const result = await pool.query(
      `UPDATE businesses 
       SET name = $1, email = $2, phone = $3, description = $4, address = $5, 
           city = $6, state = $7, country = $8, postal_code = $9, updated_at = NOW()
       WHERE id = $10 AND owner_id = $11 
       RETURNING *`,
      [name, email, phone, description, address, city, state, country, postal_code, businessId, userId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Business not found or unauthorized' }, { status: 404 })
    }

    return NextResponse.json({ business: result.rows[0] })
  } catch (error) {
    console.error('Business update error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
