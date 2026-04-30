import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getOne, getAll } from '@/lib/db';
import { getActiveBusiness } from '@/lib/active-business';

/**
 * Hourly breakdown for the Peak Hours chart, anchored to WAT so a
 * Lagos-evening order doesn't show up as the 23:00 UTC hour. We also
 * tell the client which hour is the busiest, so the UI can highlight
 * a "Peak" call-out.
 */
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') || 'today';
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

    // All windows expressed in the WAT calendar.
    let dateFilter = `(created_at AT TIME ZONE 'Africa/Lagos')::date
                       = (NOW() AT TIME ZONE 'Africa/Lagos')::date`;
    if (timeRange === 'week') {
      dateFilter = `(created_at AT TIME ZONE 'Africa/Lagos')::date
                     >= (NOW() AT TIME ZONE 'Africa/Lagos')::date - INTERVAL '6 days'`;
    } else if (timeRange === 'month' || timeRange === 'last30') {
      dateFilter = `(created_at AT TIME ZONE 'Africa/Lagos')::date
                     >= (NOW() AT TIME ZONE 'Africa/Lagos')::date - INTERVAL '30 days'`;
    }

    const hourlyData = await getAll(
      `SELECT
          EXTRACT(HOUR FROM created_at AT TIME ZONE 'Africa/Lagos')::int
            AS hour_of_day,
          COUNT(*)::int AS orders,
          COALESCE(SUM(total_amount), 0) AS revenue
        FROM orders
        WHERE business_id = $1
          AND ${dateFilter}
          AND payment_status IN ('paid', 'completed')
        GROUP BY 1
        ORDER BY 1 ASC`,
      [businessId],
    );

    // Fill in missing hours with zero so the bar chart spans 24h.
    const formattedData = Array.from({ length: 24 }, (_, i) => {
      const hourData = (hourlyData as any[]).find(
        (d) => d.hour_of_day === i,
      );
      return {
        hour: `${i.toString().padStart(2, '0')}:00`,
        orders: hourData ? parseInt(hourData.orders) : 0,
        revenue: hourData ? parseFloat(hourData.revenue) : 0,
      };
    });

    const peak = formattedData.reduce(
      (best, h) => (h.orders > best.orders ? h : best),
      formattedData[0],
    );

    return NextResponse.json({
      data: formattedData,
      peak: peak?.orders ? peak : null,
      timeRange,
    });
  } catch (error) {
    console.error('Hourly data error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch hourly data' },
      { status: 500 },
    );
  }
}
