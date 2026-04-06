import { NextRequest, NextResponse } from 'next/server'
import { Pool } from '@neondatabase/serverless'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { business_id } = body

    if (!business_id) {
      return NextResponse.json({ error: 'Business ID required' }, { status: 400 })
    }

    // Verify user owns this business
    const businessResult = await pool.query(
      'SELECT id FROM businesses WHERE id = $1 AND owner_id = $2',
      [business_id, userId]
    )

    if (businessResult.rows.length === 0) {
      return NextResponse.json({ error: 'Business not found or unauthorized' }, { status: 404 })
    }

    // Set as active business for user (you might store this in a session/cookie)
    // For now, just return success
    return NextResponse.json({ success: true, message: 'Business switched successfully' })
  } catch (error) {
    console.error('Switch business error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
