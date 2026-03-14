import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || user.role !== 'business_owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get business by owner_id
    const { rows: businessRows } = await sql.query(
      'SELECT * FROM businesses WHERE owner_id = $1 LIMIT 1',
      [user.userId]
    );

    if (businessRows.length === 0) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const businessData = businessRows[0];
    const businessId = businessData.id;

    // Get today's revenue and orders count
    const { rows: todayRows } = await sql.query(
      `SELECT 
        COUNT(*) as order_count,
        COALESCE(SUM(total_amount), 0) as revenue
      FROM orders 
      WHERE business_id = $1 
      AND DATE(created_at) = CURRENT_DATE
      AND status = 'completed'`,
      [businessId]
    );

    const todayStats = todayRows[0] || { order_count: 0, revenue: 0 };

    // Get last 7 days analytics for chart
    const { rows: chartRows } = await sql.query(
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
      todayRevenue: parseInt(todayStats.revenue) || 0,
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
