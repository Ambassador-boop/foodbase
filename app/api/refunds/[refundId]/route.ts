import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ refundId: string }> }
) {
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
    const resolvedParams = await params;
    const refundId = resolvedParams.refundId;

    // Get refund details and verify ownership
    const result = await db.query(
      `SELECT 
        r.id,
        r.order_id,
        r.amount,
        r.status,
        r.reason,
        r.notes,
        r.failure_reason,
        r.created_at,
        r.updated_at
       FROM refunds r
       JOIN orders o ON r.order_id = o.id
       JOIN businesses b ON o.business_id = b.id
       WHERE r.id = $1 AND b.owner_id = $2`,
      [refundId, userId]
    );

    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: 'Refund not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('[v0] Get refund error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch refund details' },
      { status: 500 }
    );
  }
}
