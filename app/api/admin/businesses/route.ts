import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const token = await getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await verifyToken(token);
    const role = verified?.role as string;

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const businesses = await sql.query(
      'SELECT id, name, slug, email, phone, logo_url, created_at, is_active FROM businesses ORDER BY created_at DESC'
    );

    return NextResponse.json({ businesses: businesses || [] });
  } catch (error) {
    console.error('Error fetching businesses:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
