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

    // Get today's revenue (completed transactions only) and orders count
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

    // Get today's pending revenue
    const todayPendingStats = await getOne(
      `SELECT 
        COALESCE(SUM(total_amount), 0) as pending_revenue
      FROM orders 
      WHERE business_id = $1 
      AND DATE(created_at) = CURRENT_DATE
      AND status = 'pending'`,
      [businessId]
    );

    // Get orders in last 30 days
    const last30DaysOrders = await getOne(
      `SELECT COUNT(*) as order_count
       FROM orders 
       WHERE business_id = $1 
       AND created_at >= CURRENT_DATE - INTERVAL '30 days'`,
      [businessId]
    );

    // Get completed orders count
    const completedStats = await getOne(
      `SELECT COUNT(*) as completed_count
       FROM orders 
       WHERE business_id = $1 
       AND status = 'completed'`,
      [businessId]
    );

    // Get total revenue (all completed transactions)
    const totalRevenueStats = await getOne(
      `SELECT COALESCE(SUM(total_amount), 0) as total
       FROM orders 
       WHERE business_id = $1
       AND status = 'completed'`,
      [businessId]
    );

    // Get last 7 days data from orders (not analytics table, since it might not be populated)
    const last7Days = await getAll(
      `SELECT 
        DATE(created_at) as date,
        COALESCE(SUM(total_amount), 0) as revenue,
        COUNT(*) as orders
      FROM orders 
      WHERE business_id = $1 
      AND created_at >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY DATE(created_at)
      ORDER BY DATE(created_at) ASC`,
      [businessId]
    );

    const metrics = {
      todayOrders: parseInt(todayStats?.order_count || 0) || 0,
      todayRevenue: parseFloat(todayStats?.revenue || 0) || 0,
      todayPendingRevenue: parseFloat(todayPendingStats?.pending_revenue || 0) || 0,
      last30DaysOrders: parseInt(last30DaysOrders?.order_count || 0) || 0,
      availableBalance: parseFloat(businessData.available_balance) || 0,
      pendingWithdrawals: parseFloat(businessData.pending_balance) || 0,
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
