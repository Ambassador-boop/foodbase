import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getAuthCookie } from '@/lib/auth';
import { getActiveBusinessForUser } from '@/lib/active-business';

export async function GET(req: NextRequest) {
  try {
    let token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      token = await getAuthCookie();
    }
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || user.role !== 'business_owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // The JWT payload exposes `userId`, not `id`.
    const userId = (user as any).userId || (user as any).id;

    const business = await getActiveBusinessForUser(userId);
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // matches transaction_type column
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100');

    let query = `
      SELECT 
        t.id,
        t.business_id,
        t.order_id,
        t.transaction_type,
        t.amount,
        t.payment_method,
        t.payment_reference,
        t.status,
        t.created_at,
        b.name as business_name,
        o.customer_name,
        o.total_amount as order_total
      FROM transactions t
      JOIN businesses b ON t.business_id = b.id
      LEFT JOIN orders o ON t.order_id = o.id
      WHERE t.business_id = $1
    `;
    const params: any[] = [business.id];

    if (type) {
      query += ` AND t.transaction_type = $${params.length + 1}`;
      params.push(type);
    }

    if (startDate) {
      query += ` AND t.created_at >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND t.created_at <= $${params.length + 1}`;
      params.push(endDate);
    }

    query += ` ORDER BY t.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const { rows } = await sql.query(query, params);
    return NextResponse.json(
      rows.map((r: any) => ({
        ...r,
        amount: Number(r.amount),
        order_total: r.order_total ? Number(r.order_total) : null,
      }))
    );
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
