import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'secret');

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await jwtVerify(token, secret);
    const userId = verified.payload.userId as string;
    const role = verified.payload.role as string;

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const businesses = await db.query(
      'SELECT id, name, slug, email, phone, created_at, is_active FROM businesses ORDER BY created_at DESC'
    );

    return NextResponse.json({ businesses: businesses.rows || [] });
  } catch (error) {
    console.error('Error fetching businesses:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
