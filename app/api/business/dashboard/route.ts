import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getOne, getAll } from '@/lib/db';
import { getActiveBusiness } from '@/lib/active-business';

/**
 * Dashboard summary endpoint.
 *
 * IMPORTANT: every "today / yesterday / last N days" comparison is
 * evaluated in West Africa Time (Africa/Lagos), NOT in the database
 * default timezone. This guarantees that:
 *   - An order placed at 12:30 AM WAT (= 23:30 UTC of the previous day)
 *     is counted as "today" instead of leaking into yesterday's bucket.
 *   - Date labels on the chart match the timezone the business owner
 *     actually lives in.
 *
 * The SQL pattern we use everywhere:
 *   (created_at AT TIME ZONE 'Africa/Lagos')::date = (NOW() AT TIME ZONE 'Africa/Lagos')::date
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
      'SELECT * FROM businesses WHERE id = $1 AND owner_id = $2',
      [businessId, currentUser.id],
    );

    if (!businessData) {
      return NextResponse.json(
        { error: 'Business not found or unauthorized' },
        { status: 404 },
      );
    }

    // ----- Today (WAT) -----
    const todayStats = await getOne(
      `SELECT
          COUNT(*)::int AS order_count,
          COALESCE(SUM(total_amount), 0) AS revenue
        FROM orders
        WHERE business_id = $1
          AND (created_at AT TIME ZONE 'Africa/Lagos')::date
              = (NOW() AT TIME ZONE 'Africa/Lagos')::date
          AND payment_status IN ('paid', 'completed')`,
      [businessId],
    );

    // ----- Last 30 days (WAT calendar days, inclusive of today) -----
    const last30DaysOrders = await getOne(
      `SELECT COUNT(*)::int AS order_count
         FROM orders
        WHERE business_id = $1
          AND (created_at AT TIME ZONE 'Africa/Lagos')::date
              >= (NOW() AT TIME ZONE 'Africa/Lagos')::date - INTERVAL '30 days'
          AND payment_status IN ('paid', 'completed')`,
      [businessId],
    );

    // ----- Completed orders (status filter) -----
    const completedStats = await getOne(
      `SELECT COUNT(*)::int AS completed_count
         FROM orders
        WHERE business_id = $1
          AND status IN ('completed', 'confirmed')
          AND payment_status IN ('paid', 'completed')`,
      [businessId],
    );

    // ----- Lifetime revenue -----
    const totalRevenueStats = await getOne(
      `SELECT COALESCE(SUM(total_amount), 0) AS total
         FROM orders
        WHERE business_id = $1
          AND payment_status IN ('paid', 'completed')`,
      [businessId],
    );

    // ----- Last 7 days chart (WAT day buckets) -----
    const last7Days = await getAll(
      `SELECT
          (created_at AT TIME ZONE 'Africa/Lagos')::date AS day,
          COALESCE(SUM(total_amount), 0) AS revenue,
          COUNT(*)::int AS orders
        FROM orders
        WHERE business_id = $1
          AND (created_at AT TIME ZONE 'Africa/Lagos')::date
              >= (NOW() AT TIME ZONE 'Africa/Lagos')::date - INTERVAL '6 days'
          AND payment_status IN ('paid', 'completed')
        GROUP BY 1
        ORDER BY 1 ASC`,
      [businessId],
    );

    const metrics = {
      todayOrders: parseInt(todayStats?.order_count || 0) || 0,
      todayRevenue: parseFloat(todayStats?.revenue || 0) || 0,
      last30DaysOrders: parseInt(last30DaysOrders?.order_count || 0) || 0,
      availableBalance: parseFloat(businessData.available_balance) || 0,
      pendingBalance: parseFloat(businessData.pending_balance) || 0,
      totalRevenue: parseFloat(totalRevenueStats?.total || 0) || 0,
      completedOrders: parseInt(completedStats?.completed_count || 0) || 0,
    };

    // Build a complete 7-day window so missing days render as zero.
    const buckets = new Map<string, { revenue: number; orders: number }>();
    for (const r of last7Days as any[]) {
      const ymd =
        r.day instanceof Date
          ? r.day.toISOString().slice(0, 10)
          : String(r.day).slice(0, 10);
      buckets.set(ymd, {
        revenue: Number(r.revenue) || 0,
        orders: parseInt(r.orders) || 0,
      });
    }
    const labelFmt = new Intl.DateTimeFormat('en-NG', {
      timeZone: 'Africa/Lagos',
      month: 'short',
      day: 'numeric',
    });
    const ymdFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Africa/Lagos',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const formattedChartData: Array<{
      date: string;
      revenue: number;
      orders: number;
    }> = [];
    const nowLagos = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(nowLagos.getTime() - i * 86_400_000);
      const ymd = ymdFmt.format(d);
      const bucket = buckets.get(ymd) || { revenue: 0, orders: 0 };
      formattedChartData.push({
        date: labelFmt.format(d),
        revenue: bucket.revenue,
        orders: bucket.orders,
      });
    }

    return NextResponse.json({
      metrics,
      chartData: formattedChartData,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 },
    );
  }
}
