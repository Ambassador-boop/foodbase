import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getOne, getAll } from '@/lib/db';

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
      const businessData = await getOne(
        'SELECT id FROM businesses WHERE owner_id = $1 LIMIT 1',
        [currentUser.id]
      );
      if (!businessData) {
        return NextResponse.json({ error: 'Business not found' }, { status: 404 });
      }
      businessId = businessData.id;
    }

    // Verify the business belongs to the current user
    const businessData = await getOne(
      'SELECT id FROM businesses WHERE id = $1 AND owner_id = $2',
      [businessId, currentUser.id]
    );

    if (!businessData) {
      return NextResponse.json({ error: 'Business not found or unauthorized' }, { status: 404 });
    }

    // Determine date filter based on time range
    let dateFilter = `DATE(created_at) = CURRENT_DATE`;
    if (timeRange === 'week') {
      dateFilter = `created_at >= CURRENT_DATE - INTERVAL '7 days'`;
    } else if (timeRange === 'month') {
      dateFilter = `created_at >= CURRENT_DATE - INTERVAL '30 days'`;
    }

    // Get hourly breakdown
    const hourlyData = await getAll(
      `SELECT 
        EXTRACT(HOUR FROM created_at)::int as hour_of_day,
        COUNT(*) as orders,
        COALESCE(SUM(total_amount), 0) as revenue
       FROM orders
       WHERE business_id = $1
       AND ${dateFilter}
       AND payment_status IN ('paid', 'completed')
       GROUP BY EXTRACT(HOUR FROM created_at)
       ORDER BY EXTRACT(HOUR FROM created_at) ASC`,
      [businessId]
    );

    // Format hours (fill in missing hours)
    const formattedData = Array.from({ length: 24 }, (_, i) => {
      const hourData = hourlyData.find((d: any) => d.hour_of_day === i);
      return {
        hour: `${i.toString().padStart(2, '0')}:00`,
        orders: hourData ? parseInt(hourData.orders) : 0,
        revenue: hourData ? parseFloat(hourData.revenue) : 0,
      };
    });

    return NextResponse.json({ data: formattedData });
  } catch (error) {
    console.error('Hourly data error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch hourly data' },
      { status: 500 }
    );
  }
}
