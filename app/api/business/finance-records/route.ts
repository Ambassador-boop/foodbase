import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

/**
 * Returns the audit-trail rows from `finance_records` for the
 * authenticated business owner. Used by /dashboard/finance to render
 * settlement events (pending → available) alongside payments,
 * withdrawals, and refunds.
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

    // Only return settlement-style entries — payments / withdrawals /
    // refunds already arrive via their own dedicated endpoints, and we
    // don't want to double-render them on the finance page.
    const rows: any = await db.query(
      `SELECT fr.id, fr.business_id, fr.kind, fr.amount, fr.bucket,
              fr.related_id, fr.notes, fr.created_at
         FROM finance_records fr
         JOIN businesses b ON fr.business_id = b.id
        WHERE b.owner_id = $1
          AND fr.kind = 'settlement'
        ORDER BY fr.created_at DESC
        LIMIT 200`,
      [userId],
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
