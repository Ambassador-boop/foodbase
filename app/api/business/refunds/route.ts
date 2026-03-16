import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authCookie = request.cookies.get('auth_token')?.value;

    if (!authCookie) {
      return NextResponse.json({ error: 'No auth token found' }, { status: 401 });
    }

    const user = await verifyJWT(authCookie);

    if (!user) {
      return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 });
    }

    const userId = (user as any).userId || (user as any).id;

    // Get all refunds for the business owner's orders
    const result = await db.query(
      `SELECT 
        r.id,
        r.order_id,
        r.transaction_id,
        r.amount,
        r.status,
        r.created_at,
        r.updated_at
       FROM refunds r
       JOIN orders o ON r.order_id = o.id
       JOIN businesses b ON o.business_id = b.id
       WHERE b.owner_id = $1
       ORDER BY r.created_at DESC`,
      [userId]
    );

    if (!result) {
      return NextResponse.json([]);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[v0] Get refunds error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch refunds' },
      { status: 500 }
    );
  }
}
