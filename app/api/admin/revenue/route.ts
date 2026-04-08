import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      console.error('[v0] No token provided to /api/admin/revenue');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let user;
    try {
      user = await verifyToken(token);
    } catch (tokenErr) {
      console.error('[v0] Token verification failed:', tokenErr);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!user) {
      console.error('[v0] User not found in token');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      console.error('[v0] User role is not admin:', user.role);
      return NextResponse.json({ error: 'Forbidden - admin role required' }, { status: 403 });
    }

    // Ensure admin_revenue record exists
    try {
      const countResult = await sql`SELECT COUNT(*) as count FROM admin_revenue`;
      if (countResult.rows[0].count === '0' || countResult.rows[0].count === 0) {
        await sql`INSERT INTO admin_revenue (total_revenue, withdrawn_amount, available_balance) VALUES (0, 0, 0)`;
      }
    } catch (err) {
      console.error('[v0] Error ensuring admin_revenue record exists:', err);
    }

    // Get admin revenue summary
    const revenueResult = await sql`
      SELECT total_revenue, withdrawn_amount, available_balance, updated_at
      FROM admin_revenue
      ORDER BY updated_at DESC
      LIMIT 1
    `;

    const revenue = revenueResult.rows[0] || {
      total_revenue: 0,
      withdrawn_amount: 0,
      available_balance: 0,
      updated_at: new Date().toISOString(),
    };

    // Get daily revenue breakdown
    const dailyResult = await sql`
      SELECT 
        DATE(osf.created_at) as date,
        COUNT(*) as transaction_count,
        SUM(osf.service_fee_amount) as daily_revenue
      FROM order_service_fees osf
      WHERE osf.service_fee_type = 'tiered'
      GROUP BY DATE(osf.created_at)
      ORDER BY date DESC
      LIMIT 30
    `;

    // Get top restaurants by revenue
    const restaurantsResult = await sql`
      SELECT 
        b.id,
        b.name,
        COUNT(DISTINCT osf.order_id) as transaction_count,
        SUM(osf.service_fee_amount) as restaurant_revenue
      FROM order_service_fees osf
      JOIN orders o ON osf.order_id = o.id
      JOIN businesses b ON o.business_id = b.id
      WHERE osf.service_fee_type = 'tiered'
      GROUP BY b.id, b.name
      ORDER BY restaurant_revenue DESC
      LIMIT 10
    `;

    // Get recent transactions
    const recentResult = await sql`
      SELECT 
        osf.id,
        osf.order_id,
        osf.service_fee_amount,
        osf.service_fee_type,
        osf.created_at,
        b.name as business_name
      FROM order_service_fees osf
      JOIN orders o ON osf.order_id = o.id
      JOIN businesses b ON o.business_id = b.id
      ORDER BY osf.created_at DESC
      LIMIT 5
    `;

    return NextResponse.json({
      summary: revenue,
      dailyBreakdown: dailyResult.rows,
      topRestaurants: restaurantsResult.rows,
      recentTransactions: recentResult.rows,
    });
  } catch (error) {
    console.error('Failed to fetch revenue data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
