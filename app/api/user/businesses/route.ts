import { NextRequest, NextResponse } from 'next/server'
import { Pool } from '@neondatabase/serverless'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function GET(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await pool.query(
      'SELECT id, name, email, phone FROM businesses WHERE owner_id = $1 ORDER BY created_at DESC',
      [userId]
    )

    return NextResponse.json({ businesses: result.rows })
  } catch (error) {
    console.error('Businesses fetch error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
