import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { getActiveBusinessForUser } from '@/lib/active-business';

/**
 * Returns settlement-style audit rows from `finance_records` for the
 * authenticated business owner's ACTIVE business only. The `record_type`
 * column was named differently from the API's external "kind" alias on
 * purpose — we keep the public field as `kind` so the dashboard code stays
 * stable if we ever reshape the table.
 *
 * Used by /dashboard/finance to render settlement events
 * (pending → available) alongside payments / withdrawals / refunds.
 *
 * IMPORTANT: This endpoint filters by active business_id to prevent
 * cross-business visibility. Each business owner only sees their
 * currently active business's finance records.
 */
export async function GET(request: NextRequest) {
  try {
    const token =
      request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const userId = (payload as any).userId || (payload as any).id;

    // Get the active business to ensure we only show that business's records
    const activeBusiness = await getActiveBusinessForUser(userId);
    if (!activeBusiness) {
      return NextResponse.json(
        { error: 'No active business found' },
        { status: 404 },
      );
    }

    // Settlement entries only — payments / withdrawals / refunds are
    // already streamed in via their own dedicated endpoints, and we
    // don't want to double-render them on the finance page.
    const rows: any = await db.query(
      `SELECT fr.id,
              fr.business_id,
              fr.record_type AS kind,
              fr.amount,
              fr.bucket,
              fr.related_id,
              fr.description AS notes,
              fr.created_at
         FROM finance_records fr
        WHERE fr.business_id = $1
          AND fr.record_type = 'settlement'
        ORDER BY fr.created_at DESC
        LIMIT 200`,
      [activeBusiness.id],
    );
    const list = (Array.isArray(rows) ? rows : rows?.rows ?? []).map(
      (r: any) => ({
        id: r.id,
        kind: r.kind,
        amount: Number(r.amount || 0),
        bucket: r.bucket,
        related_id: r.related_id,
        notes: r.notes,
        created_at: r.created_at,
      }),
    );
    return NextResponse.json(list);
  } catch (err) {
    console.error('[v0] GET /business/finance-records error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch finance records' },
      { status: 500 },
    );
  }
}
