import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAll, getOne } from '@/lib/db';
import { getActiveBusiness } from '@/lib/active-business';

/**
 * Day-of-week breakdown over the last 30 WAT days. Tells the business
 * owner which weekdays drive most revenue / orders so they can plan
 * staffing and inventory.
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

    // 0 = Sunday … 6 = Saturday in postgres `dow`.
    const rows = await getAll(
      `SELECT
          EXTRACT(DOW FROM created_at AT TIME ZONE 'Africa/Lagos')::int AS dow,
          COUNT(*)::int AS orders,
          COALESCE(SUM(total_amount), 0) AS revenue
        FROM orders
        WHERE business_id = $1
          AND (created_at AT TIME ZONE 'Africa/Lagos')::date
              >= (NOW() AT TIME ZONE 'Africa/Lagos')::date - INTERVAL '${intervalDays} days'
          AND payment_status IN ('paid', 'completed')
        GROUP BY 1
        ORDER BY 1`,
      [businessId],
    );

    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data = labels.map((label, dow) => {
      const r = (rows as any[]).find((x) => x.dow === dow);
      return {
        dow,
        label,
        orders: r ? Number(r.orders) : 0,
        revenue: r ? Number(r.revenue) : 0,
      };
    });

    const peak = data.reduce(
      (best, d) => (d.revenue > best.revenue ? d : best),
      data[0],
    );

    return NextResponse.json({ data, peak: peak?.revenue ? peak : null });
  } catch (err) {
    console.error('Weekday breakdown error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch weekday breakdown' },
      { status: 500 },
    );
  }
}
