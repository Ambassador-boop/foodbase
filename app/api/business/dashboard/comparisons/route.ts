import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getOne } from '@/lib/db';
import { getActiveBusiness } from '@/lib/active-business';

/**
 * Today vs Yesterday — both windows are anchored to the WAT calendar
 * day so a 12:30 AM WAT order doesn't get classified as "yesterday"
 * by virtue of being yesterday in UTC.
 *
 * Returns four metrics: orders, revenue, AOV, unique customers.
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    let businessId = searchParams.get('businessId');

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

    const businessData = await getOne(
      'SELECT id FROM businesses WHERE id = $1 AND owner_id = $2',
      [businessId, currentUser.id],
    );
    if (!businessData) {
      return NextResponse.json(
        { error: 'Business not found or unauthorized' },
        { status: 404 },
      );
    }

    const todayOrders = await getOne(
      `SELECT
         COUNT(*)::int AS count,
         COALESCE(SUM(total_amount), 0) AS revenue,
         COUNT(DISTINCT NULLIF(customer_email, ''))::int AS customers
       FROM orders
       WHERE business_id = $1
         AND (created_at AT TIME ZONE 'Africa/Lagos')::date
             = (NOW() AT TIME ZONE 'Africa/Lagos')::date
         AND payment_status IN ('paid', 'completed')`,
      [businessId],
    );

    const yesterdayOrders = await getOne(
      `SELECT
         COUNT(*)::int AS count,
         COALESCE(SUM(total_amount), 0) AS revenue,
         COUNT(DISTINCT NULLIF(customer_email, ''))::int AS customers
       FROM orders
       WHERE business_id = $1
         AND (created_at AT TIME ZONE 'Africa/Lagos')::date
             = (NOW() AT TIME ZONE 'Africa/Lagos')::date - INTERVAL '1 day'
         AND payment_status IN ('paid', 'completed')`,
      [businessId],
    );

    const pct = (today: number, prior: number) =>
      prior > 0 ? ((today - prior) / prior) * 100 : today > 0 ? 100 : 0;

    const todayCount = Number(todayOrders?.count || 0);
    const yestCount = Number(yesterdayOrders?.count || 0);
    const todayRev = Number(todayOrders?.revenue || 0);
    const yestRev = Number(yesterdayOrders?.revenue || 0);
    const todayCust = Number(todayOrders?.customers || 0);
    const yestCust = Number(yesterdayOrders?.customers || 0);
    const todayAov = todayCount > 0 ? todayRev / todayCount : 0;
    const yestAov = yestCount > 0 ? yestRev / yestCount : 0;

    const orderChange = pct(todayCount, yestCount);
    const revenueChange = pct(todayRev, yestRev);
    const custChange = pct(todayCust, yestCust);
    const aovChange = pct(todayAov, yestAov);

    const comparisons = [
      {
        metric: 'Orders',
        today: todayCount,
        yesterday: yestCount,
        changePercent: orderChange,
        isIncrease: orderChange >= 0,
      },
      {
        metric: 'Revenue',
        today: todayRev,
        yesterday: yestRev,
        changePercent: revenueChange,
        isIncrease: revenueChange >= 0,
      },
      {
        metric: 'Avg Order Value',
        today: Math.round(todayAov),
        yesterday: Math.round(yestAov),
        changePercent: aovChange,
        isIncrease: aovChange >= 0,
      },
      {
        metric: 'Customers',
        today: todayCust,
        yesterday: yestCust,
        changePercent: custChange,
        isIncrease: custChange >= 0,
      },
    ];

    return NextResponse.json({ comparisons });
  } catch (error) {
    console.error('Comparisons error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comparisons' },
      { status: 500 },
    );
  }
}
