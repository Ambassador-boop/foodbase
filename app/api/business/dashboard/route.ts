import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getOne, getAll } from '@/lib/db';
import { getActiveBusiness } from '@/lib/active-business';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve business: explicit query param wins, otherwise the active
    // business cookie set when the user switched in the sidebar.
    const { searchParams } = new URL(request.url);
    let businessId = searchParams.get('businessId');

    if (!businessId) {
      const active = await getActiveBusiness();
      if (!active) {
        return NextResponse.json({ error: 'Business not found' }, { status: 404 });
      }
      businessId = active.id;
    }

    // Verify the business belongs to the current user
    const businessData = await getOne(
      'SELECT * FROM businesses WHERE id = $1 AND owner_id = $2',
      [businessId, currentUser.id]
    );

    if (!businessData) {
      return NextResponse.json({ error: 'Business not found or unauthorized' }, { status: 404 });
    }

    // Get today's paid orders (covers both 'paid' from verify/webhook and any
    // legacy 'completed' rows)
    const todayStats = await getOne(
      `SELECT 
        COUNT(*) as order_count,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM orders 
      WHERE business_id = $1 
      AND DATE(created_at) = CURRENT_DATE
      AND payment_status IN ('paid', 'completed')`,
      [businessId]
    );

    // Get orders in last 30 days
    const last30DaysOrders = await getOne(
      `SELECT COUNT(*) as order_count
       FROM orders 
       WHERE business_id = $1 
       AND created_at >= CURRENT_DATE - INTERVAL '30 days'
       AND payment_status IN ('paid', 'completed')`,
      [businessId]
    );

    // Completed orders = paid orders that have been fulfilled
    const completedStats = await getOne(
      `SELECT COUNT(*) as completed_count
       FROM orders 
       WHERE business_id = $1 
       AND status IN ('completed', 'confirmed')
       AND payment_status IN ('paid', 'completed')`,
      [businessId]
    );

    // Lifetime revenue (paid orders only)
    const totalRevenueStats = await getOne(
      `SELECT COALESCE(SUM(total_amount), 0) as total
       FROM orders 
       WHERE business_id = $1
       AND payment_status IN ('paid', 'completed')`,
      [businessId]
    );

    // Last 7 days for the chart, paid orders only
    const last7Days = await getAll(
      `SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(total_amount), 0) as revenue,
        COUNT(*) as orders
      FROM orders 
      WHERE business_id = $1 
      AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      AND payment_status IN ('paid', 'completed')
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC`,
      [businessId]
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

    const formattedChartData = last7Days.map((row: any) => ({
      date: new Date(row.date).toLocaleDateString('en-NG', { month: 'short', day: 'numeric' }),
      revenue: parseFloat(row.revenue) || 0,
      orders: parseInt(row.orders) || 0,
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
