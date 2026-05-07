import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = await getTokenFromRequest(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - admin role required' }, { status: 403 });
    }

    // Get pagination params
    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await sql`
      SELECT COUNT(*) as count FROM withdrawals
    `;

    const total = parseInt(countResult.rows[0].count);

    // Get withdrawals with business info
    const result = await sql`
      SELECT 
        w.id,
        w.business_id,
        w.amount,
        w.net_amount,
        w.withdrawal_fee,
        w.service_fee,
        w.bank_code,
        w.bank_account_number,
        w.bank_account_holder,
        w.status,
        w.paystack_transfer_id,
        w.created_at,
        w.updated_at,
        w.requested_at,
        w.processed_at,
        b.name as business_name
      FROM withdrawals w
      LEFT JOIN businesses b ON w.business_id = b.id
      ORDER BY w.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    return NextResponse.json({
      withdrawals: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Failed to fetch withdrawals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
