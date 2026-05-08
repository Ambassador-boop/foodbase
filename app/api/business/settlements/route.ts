import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { getActiveBusinessForUser } from '@/lib/active-business';

/**
 * Returns aggregated daily settlements for the authenticated user's active business.
 * Each settlement represents all transactions settled on a particular day,
 * grouped by DATE(created_at).
 *
 * This prevents the dashboard from showing 100+ individual settlement rows,
 * instead showing one row per settlement day with the total amount and
 * transaction count.
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

    // Get the active business
    const activeBusiness = await getActiveBusinessForUser(userId);
    if (!activeBusiness) {
      return NextResponse.json(
        { error: 'No active business found' },
        { status: 404 },
      );
    }

    // Query all settlement records for this business, grouped by date
    const settlementRows: any = await db.query(
      `SELECT DATE(fr.created_at) as settlement_date,
              COUNT(*) as transaction_count,
              SUM(fr.amount) as total_amount,
              MIN(fr.created_at) as first_settlement_time,
              MAX(fr.created_at) as last_settlement_time
         FROM finance_records fr
        WHERE fr.business_id = $1
          AND fr.record_type = 'settlement'
        GROUP BY DATE(fr.created_at)
        ORDER BY DATE(fr.created_at) DESC
        LIMIT 200`,
      [activeBusiness.id],
    );

    const settlements = (Array.isArray(settlementRows) ? settlementRows : settlementRows?.rows ?? []).map(
      (row: any) => ({
        settlement_date: row.settlement_date,
        transaction_count: Number(row.transaction_count || 0),
        total_amount: Number(row.total_amount || 0),
        first_settlement_time: row.first_settlement_time,
        last_settlement_time: row.last_settlement_time,
      }),
    );

    return NextResponse.json(settlements);
  } catch (err) {
    console.error('[v0] GET /business/settlements error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch settlements' },
      { status: 500 },
    );
  }
}
