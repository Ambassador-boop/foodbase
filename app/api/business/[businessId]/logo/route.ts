import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@vercel/postgres'
import { verifyJWT } from '@/lib/auth'
import { uploadImage } from '@/lib/cloudinary'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
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

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 5MB limit' }, { status: 400 })
    }

    const { businessId } = await params

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 })
    }

    // Upload to Cloudinary
    const logoUrl = await uploadImage(file, 'business-logos', `logo_${businessId}`)

    // Update database with Cloudinary URL
    const result = await sql.query(
      'UPDATE businesses SET logo_url = $1 WHERE id = $2 AND owner_id = $3 RETURNING logo_url',
      [logoUrl, businessId, payload.userId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    return NextResponse.json({ logo_url: result.rows[0].logo_url })
  } catch (error) {
    console.error('Logo upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
