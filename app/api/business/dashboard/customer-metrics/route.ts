import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getOne, getAll } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get businessId from query params or use the first one
    const { searchParams } = new URL(request.url);
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

    // New customers today (distinct customer emails from today's orders)
    const newCustomersToday = await getOne(
      `SELECT COUNT(DISTINCT customer_email) as count
       FROM orders
       WHERE business_id = $1
       AND DATE(created_at) = CURRENT_DATE
       AND customer_email IS NOT NULL`,
      [businessId]
    );

    // Average order value (all completed orders)
    const aovStats = await getOne(
      `SELECT AVG(total_amount) as avg_value
       FROM orders
       WHERE business_id = $1
       AND payment_status = 'completed'`,
      [businessId]
    );

    // Repeat customer rate
    const repeatRateStats = await getOne(
      `SELECT 
        (COUNT(CASE WHEN customer_order_count > 1 THEN 1 END)::float / COUNT(*) * 100) as repeat_rate
       FROM (
         SELECT customer_email, COUNT(*) as customer_order_count
         FROM orders
         WHERE business_id = $1 AND customer_email IS NOT NULL
         GROUP BY customer_email
       ) customer_counts`,
      [businessId]
    );

    const metrics = {
      newCustomersToday: parseInt(newCustomersToday?.count || 0) || 0,
      averageOrderValue: parseFloat(aovStats?.avg_value || 0) || 0,
      repeatCustomerRate: parseFloat(repeatRateStats?.repeat_rate || 0) || 0,
    };

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('Customer metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer metrics' },
      { status: 500 }
    );
  }
}
