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

    // 8MB cap for cover photos (larger than logos because banner-quality)
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size exceeds 8MB limit' }, { status: 400 })
    }

    const { businessId } = await params

    if (!businessId) {
      return NextResponse.json({ error: 'Business ID is required' }, { status: 400 })
    }

    // Make sure the requesting user actually owns this business before uploading
    const ownerCheck = await sql.query(
      'SELECT id FROM businesses WHERE id = $1 AND owner_id = $2',
      [businessId, payload.userId]
    )

    if (ownerCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    // Upload to Cloudinary
    const coverUrl = await uploadImage(file, 'business-covers', `cover_${businessId}`)

    // Persist to the businesses.cover_image_url column
    const result = await sql.query(
      `UPDATE businesses
       SET cover_image_url = $1, updated_at = NOW()
       WHERE id = $2 AND owner_id = $3
       RETURNING cover_image_url`,
      [coverUrl, businessId, payload.userId]
    )

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    return NextResponse.json({ cover_image_url: result.rows[0].cover_image_url })
  } catch (error) {
    console.error('Cover image upload error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
