import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getOne } from '@/lib/db';
import { getActiveBusiness } from '@/lib/active-business';

/**
 * Customer-centric KPIs: today's first-time customers (WAT day),
 * lifetime average order value, and the share of customers who have
 * made more than one order. Used by both /dashboard and /dashboard/analytics.
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

    // First-time customers today: distinct customer emails whose
    // earliest paid order falls inside the WAT calendar day.
    const newCustomersToday = await getOne(
      `WITH first_orders AS (
         SELECT customer_email,
                MIN(created_at) AS first_at
           FROM orders
          WHERE business_id = $1
            AND customer_email IS NOT NULL
            AND customer_email <> ''
            AND payment_status IN ('paid','completed')
          GROUP BY customer_email
       )
       SELECT COUNT(*)::int AS count
         FROM first_orders
        WHERE (first_at AT TIME ZONE 'Africa/Lagos')::date
              = (NOW() AT TIME ZONE 'Africa/Lagos')::date`,
      [businessId],
    );

    const aovStats = await getOne(
      `SELECT AVG(total_amount) AS avg_value
         FROM orders
        WHERE business_id = $1
          AND payment_status IN ('paid', 'completed')`,
      [businessId],
    );

    const repeatRateStats = await getOne(
      `SELECT
         (COUNT(CASE WHEN customer_order_count > 1 THEN 1 END)::float
          / NULLIF(COUNT(*), 0) * 100) AS repeat_rate,
         COUNT(*)::int AS total_customers,
         COUNT(CASE WHEN customer_order_count > 1 THEN 1 END)::int
           AS returning_customers
       FROM (
         SELECT customer_email, COUNT(*) AS customer_order_count
           FROM orders
          WHERE business_id = $1
            AND customer_email IS NOT NULL
            AND customer_email <> ''
            AND payment_status IN ('paid','completed')
          GROUP BY customer_email
       ) c`,
      [businessId],
    );

    const metrics = {
      newCustomersToday: parseInt(newCustomersToday?.count || 0) || 0,
      averageOrderValue: parseFloat(aovStats?.avg_value || 0) || 0,
      repeatCustomerRate: parseFloat(repeatRateStats?.repeat_rate || 0) || 0,
      totalCustomers: parseInt(repeatRateStats?.total_customers || 0) || 0,
      returningCustomers:
        parseInt(repeatRateStats?.returning_customers || 0) || 0,
    };

    return NextResponse.json({ metrics });
  } catch (error) {
    console.error('Customer metrics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch customer metrics' },
      { status: 500 },
    );
  }
}
