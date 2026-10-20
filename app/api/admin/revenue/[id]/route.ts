import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const token = await getTokenFromRequest(req);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;

    // Get transaction details
    const result = await sql`
      SELECT 
        osf.id,
        osf.order_id,
        osf.service_fee_amount,
        osf.service_fee_type,
        osf.created_at,
        o.id as order_id,
        o.total_amount,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        o.address,
        o.status as order_status,
        o.payment_status,
        o.created_at as order_created_at,
        o.paid_at,
        b.id as business_id,
        b.name as business_name
      FROM order_service_fees osf
      JOIN orders o ON osf.order_id = o.id
      JOIN businesses b ON o.business_id = b.id
      WHERE osf.id = ${id}
    `;

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const transaction = result.rows[0];

    // Get order items details
    const itemsResult = await sql`
      SELECT 
        oi.id,
        oi.menu_item_id,
        oi.quantity,
        oi.item_price,
        mi.name as item_name,
        oi.configuration
      FROM order_items oi
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE oi.order_id = ${transaction.order_id}
    `;

    return NextResponse.json({
      transaction,
      orderItems: itemsResult.rows,
    });
  } catch (error) {
    console.error('Failed to fetch transaction details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
