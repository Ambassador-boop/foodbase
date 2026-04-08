import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get pagination params
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as total
      FROM order_service_fees osf
    `;

    const total = parseInt(countResult.rows[0].total);

    // Get paginated transactions with order and business details
    const result = await sql`
      SELECT 
        osf.id,
        osf.order_id,
        osf.service_fee_amount,
        osf.service_fee_type,
        osf.created_at,
        o.total_amount,
        o.customer_name,
        o.customer_email,
        o.status as order_status,
        b.id as business_id,
        b.name as business_name
      FROM order_service_fees osf
      JOIN orders o ON osf.order_id = o.id
      JOIN businesses b ON o.business_id = b.id
      ORDER BY osf.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return NextResponse.json({
      transactions: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
