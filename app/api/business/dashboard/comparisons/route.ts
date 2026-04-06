import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getOne } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get business
    const businessData = await getOne(
      'SELECT * FROM businesses WHERE owner_id = $1 LIMIT 1',
      [currentUser.id]
    );

    if (!businessData) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const businessId = businessData.id;

    // Today's orders
    const todayOrders = await getOne(
      `SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue
       FROM orders
       WHERE business_id = $1
       AND DATE(created_at) = CURRENT_DATE
       AND payment_status = 'completed'`,
      [businessId]
    );

    // Yesterday's orders
    const yesterdayOrders = await getOne(
      `SELECT COUNT(*) as count, COALESCE(SUM(total_amount), 0) as revenue
       FROM orders
       WHERE business_id = $1
       AND DATE(created_at) = CURRENT_DATE - INTERVAL '1 day'
       AND payment_status = 'completed'`,
      [businessId]
    );

    // Calculate percentage changes
    const orderChange = yesterdayOrders?.count ? 
      ((parseInt(todayOrders?.count || 0) - parseInt(yesterdayOrders?.count || 0)) / parseInt(yesterdayOrders?.count || 1)) * 100 : 0;

    const revenueChange = yesterdayOrders?.revenue ?
      ((parseFloat(todayOrders?.revenue || 0) - parseFloat(yesterdayOrders?.revenue || 0)) / parseFloat(yesterdayOrders?.revenue || 1)) * 100 : 0;

    const comparisons = [
      {
        metric: 'Orders',
        today: parseInt(todayOrders?.count || 0) || 0,
        yesterday: parseInt(yesterdayOrders?.count || 0) || 0,
        changePercent: orderChange,
        isIncrease: orderChange >= 0,
      },
      {
        metric: 'Revenue',
        today: parseFloat(todayOrders?.revenue || 0) || 0,
        yesterday: parseFloat(yesterdayOrders?.revenue || 0) || 0,
        changePercent: revenueChange,
        isIncrease: revenueChange >= 0,
      },
    ];

    return NextResponse.json({ comparisons });
  } catch (error) {
    console.error('Comparisons error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comparisons' },
      { status: 500 }
    );
  }
}
