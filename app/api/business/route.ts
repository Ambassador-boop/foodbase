import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { verifyJWT } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    let token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      token = request.cookies.get('auth_token')?.value;
    }

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get first business owned by this user (primary business)
    const { rows } = await sql.query(
      'SELECT id, name, slug, email, logo_url, is_active FROM businesses WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1',
      [payload.userId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No business found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      business: rows[0],
    });
  } catch (error) {
    console.error('[v0] Get business error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch business' },
      { status: 500 }
    );
  }
}
