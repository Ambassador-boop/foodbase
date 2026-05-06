import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = await getTokenFromRequest(req);
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

    // Get service fees count
    const serviceFeeCount = await sql`
      SELECT COUNT(*) as count FROM order_service_fees
    `;

    // Get withdrawal fees count
    const withdrawalFeeCount = await sql`
      SELECT COUNT(*) as count FROM withdrawals 
      WHERE withdrawal_fee > 0 AND status NOT IN ('failed', 'rejected', 'abandoned', 'blocked')
    `;

    const total = parseInt(serviceFeeCount.rows[0].count) + parseInt(withdrawalFeeCount.rows[0].count);

    // Get service fees transactions
    const serviceFees = await sql`
      SELECT 
        osf.id,
        osf.order_id,
        osf.service_fee_amount as amount,
        'service_fee' as transaction_type,
        osf.service_fee_type as fee_type,
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
      LIMIT ${Math.floor(limit / 2)} OFFSET ${Math.floor(offset / 2)}
    `;

    // Get withdrawal fees transactions
    const withdrawalFees = await sql`
      SELECT 
        w.id,
        NULL as order_id,
        w.withdrawal_fee as amount,
        'withdrawal_fee' as transaction_type,
        NULL as fee_type,
        w.created_at,
        NULL as total_amount,
        NULL as customer_name,
        NULL as customer_email,
        w.status as order_status,
        b.id as business_id,
        b.name as business_name
      FROM withdrawals w
      JOIN businesses b ON w.business_id = b.id
      WHERE w.withdrawal_fee > 0 AND w.status NOT IN ('failed', 'rejected', 'abandoned', 'blocked')
      ORDER BY w.created_at DESC
      LIMIT ${Math.floor(limit / 2)} OFFSET ${Math.floor(offset / 2)}
    `;

    // Combine and sort
    const combinedTransactions = [
      ...serviceFees.rows,
      ...withdrawalFees.rows,
    ].sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ).slice(0, limit);

    return NextResponse.json({
      transactions: combinedTransactions,
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
