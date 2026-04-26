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

    // Return ALL businesses owned by this user so the dashboard switcher
    // works correctly. The `business` (singular) field is kept for backward
    // compatibility with pages that expect a primary business.
    const { rows } = await sql.query(
      `SELECT 
         id, name, slug, email, phone, description,
         logo_url, cover_image_url,
         address, city, state, country, postal_code,
         is_active,
         total_orders,
         available_balance, pending_balance,
         created_at, updated_at
       FROM businesses 
       WHERE owner_id = $1 
       ORDER BY created_at ASC`,
      [(payload as any).userId || (payload as any).id]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No business found' }, { status: 404 });
    }

    const businesses = rows.map((b: any) => ({
      ...b,
      total_orders: Number(b.total_orders ?? 0),
      available_balance: Number(b.available_balance ?? 0),
      pending_balance: Number(b.pending_balance ?? 0),
    }));

    return NextResponse.json({
      success: true,
      business: businesses[0],
      businesses,
    });
  } catch (error) {
    console.error('[v0] Get business error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch business' },
      { status: 500 }
    );
  }
}
