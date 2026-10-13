import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { maskEmail } from '@/lib/mask';
import { getActiveBusinessForUser } from '@/lib/active-business';

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
    const business = await getActiveBusinessForUser(userId);
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Get all refunds for the business owner's orders. We expose both the
    // legacy integer `amount` and the new numeric `refund_amount` columns,
    // collapsed into a single `amount` field.
    const result: any = await db.query(
      `SELECT 
        r.id,
        r.order_id,
        r.transaction_id,
        r.business_id,
        r.original_amount,
        r.refund_amount,
        r.amount AS legacy_amount,
        r.status,
        r.failure_reason,
        r.requested_at,
        r.processed_at,
        r.created_at,
        r.updated_at,
        o.customer_name,
        o.customer_email
       FROM refunds r
       LEFT JOIN orders o ON r.order_id = o.id
       WHERE r.business_id = $1
       ORDER BY r.created_at DESC
       LIMIT 200`,
      [business.id]
    );

    const rows = Array.isArray(result) ? result : (result?.rows ?? []);

    return NextResponse.json(
      rows.map((r: any) => ({
        id: r.id,
        order_id: r.order_id,
        transaction_id: r.transaction_id,
        business_id: r.business_id,
        amount: Number(r.refund_amount ?? r.legacy_amount ?? 0),
        original_amount: r.original_amount ? Number(r.original_amount) : null,
        status: r.status,
        failure_reason: r.failure_reason,
        requested_at: r.requested_at,
        processed_at: r.processed_at,
        created_at: r.created_at,
        updated_at: r.updated_at,
        customer_name: r.customer_name,
        customer_email_masked: maskEmail(r.customer_email),
      }))
    );
  } catch (error) {
    console.error('[v0] Get refunds error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch refunds' },
      { status: 500 }
    );
  }
}
