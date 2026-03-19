import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { sql } from '@/lib/db';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'secret');

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await jwtVerify(token, secret);
    const userId = verified.payload.userId as string;

    // Get all businesses owned by this user
    const businesses = await sql.query(
      'SELECT id, name, slug, email, is_active FROM businesses WHERE owner_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    return NextResponse.json({
      success: true,
      businesses: businesses || [],
    });
  } catch (error) {
    console.error('[v0] Get business error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch business' },
      { status: 500 }
    );
  }
}
