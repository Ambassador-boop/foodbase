import { NextRequest, NextResponse } from 'next/server'
import { Pool } from '@neondatabase/serverless'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function POST(request: NextRequest) {
  try {
    const userId = request.headers.get('x-user-id')

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 400 })
    }

    // Convert file to base64 or upload to cloud storage
    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    const dataUrl = `data:${file.type};base64,${base64}`

    // Save to database
    const result = await pool.query(
      'UPDATE users SET profile_picture_url = $1 WHERE id = $2 RETURNING profile_picture_url',
      [dataUrl, userId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ picture_url: result.rows[0].profile_picture_url })
  } catch (error) {
    console.error('Picture upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
