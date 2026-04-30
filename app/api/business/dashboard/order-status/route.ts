import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAll, getOne } from '@/lib/db';
import { getActiveBusiness } from '@/lib/active-business';

/**
 * Order-status distribution over a configurable window. Powers the
 * status doughnut on /dashboard/analytics, plus the pending-order
 * badge on the home dashboard.
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let businessId = searchParams.get('businessId');
    const range = searchParams.get('range') || '30d';
    const intervalDays = range === '7d' ? 6 : range === '90d' ? 89 : 29;

    if (!businessId) {
      const active = await getActiveBusiness();
      if (!active) {
        return NextResponse.json(
          { error: 'Business not found' },
          { status: 404 },
        );
      }
      businessId = active.id;
    }

    const business = await getOne(
      'SELECT id FROM businesses WHERE id = $1 AND owner_id = $2',
      [businessId, currentUser.id],
    );
    if (!business) {
      return NextResponse.json(
        { error: 'Business not found or unauthorized' },
        { status: 404 },
      );
    }

    const rows = await getAll(
      `SELECT
          status,
          payment_status,
          COUNT(*)::int AS count,
          COALESCE(SUM(total_amount), 0) AS revenue
        FROM orders
        WHERE business_id = $1
          AND (created_at AT TIME ZONE 'Africa/Lagos')::date
              >= (NOW() AT TIME ZONE 'Africa/Lagos')::date - INTERVAL '${intervalDays} days'
        GROUP BY status, payment_status`,
      [businessId],
    );

    // Roll up into the four buckets the UI cares about.
    let completed = 0;
    let confirmed = 0;
    let pending = 0;
    let failed = 0;
    let cancelled = 0;

    for (const r of rows as any[]) {
      const c = Number(r.count) || 0;
      const status = String(r.status || '').toLowerCase();
      const payment = String(r.payment_status || '').toLowerCase();
      if (status === 'completed') completed += c;
      else if (status === 'confirmed') confirmed += c;
      else if (status === 'cancelled') cancelled += c;
      else if (payment === 'failed' || payment === 'abandoned') failed += c;
      else pending += c;
    }

    const total = completed + confirmed + pending + failed + cancelled;
    const fmt = (count: number) => ({
      count,
      pct: total > 0 ? (count / total) * 100 : 0,
    });

    return NextResponse.json({
      total,
      breakdown: {
        completed: fmt(completed),
        confirmed: fmt(confirmed),
        pending: fmt(pending),
        failed: fmt(failed),
        cancelled: fmt(cancelled),
      },
    });
  } catch (err) {
    console.error('Order status breakdown error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch order status breakdown' },
      { status: 500 },
    );
  }
}
