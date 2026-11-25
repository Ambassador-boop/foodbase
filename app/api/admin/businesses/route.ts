import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { sql } from '@/lib/db';
import { fail } from '@/lib/api';

export async function GET(request: NextRequest) {
  try {
    const token = await getTokenFromRequest(request);

    if (!token) {
      return fail('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const verified = await verifyToken(token);
    const role = verified?.role as string;

    if (role !== 'admin') {
      return fail('FORBIDDEN', 'Forbidden', 403);
    }

    const businesses = await sql.query(
      'SELECT id, name, slug, email, phone, logo_url, created_at, is_active FROM businesses ORDER BY created_at DESC'
    );

    return NextResponse.json({ businesses: businesses || [] });
  } catch (error) {
    console.error('Error fetching businesses:', error);
    return fail('INTERNAL_SERVER_ERROR', 'Internal Server Error', 500);
  }
}
