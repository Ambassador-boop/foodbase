import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getOne, getAll } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get business by owner_id
    const businessData = await getOne(
      'SELECT * FROM businesses WHERE owner_id = $1 LIMIT 1',
      [currentUser.id]
    );

    if (!businessData) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const businessId = businessData.id;

    // Get today's revenue and orders count
    const todayStats = await getOne(
      `SELECT 
        COUNT(*) as order_count,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM orders 
      WHERE business_id = $1 
      AND DATE(created_at) = CURRENT_DATE
      AND status = 'completed'`,
      [businessId]
    );

    // Get last 7 days analytics for chart
    const chartRows = await getAll(
      `SELECT 
        DATE(date) as date,
        COALESCE(SUM(total_revenue), 0) as revenue
      FROM analytics 
      WHERE business_id = $1 
      AND date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(date)
      ORDER BY DATE(date) ASC`,
      [businessId]
    );

    const metrics = {
      totalOrders: businessData.total_orders || 0,
      todayRevenue: parseInt(todayStats?.revenue || 0) || 0,
      availableBalance: parseFloat(businessData.available_balance) || 0,
      pendingWithdrawals: parseFloat(businessData.pending_balance) || 0,
    };

    const formattedChartData = chartRows.map((row: any) => ({
      date: new Date(row.date).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' }),
      revenue: parseInt(row.revenue),
    }));

    return NextResponse.json({
      metrics,
      chartData: formattedChartData || [],
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
