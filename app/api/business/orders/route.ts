import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAll, query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = parseInt(searchParams.get('offset') || '0');

    let queryStr = `
      SELECT o.*, b.name as business_name, b.slug
      FROM orders o
      JOIN businesses b ON o.business_id = b.id
      WHERE b.owner_id = $1
    `;
    const params: any[] = [currentUser.id];

    if (status) {
      queryStr += ` AND o.status = $${params.length + 1}`;
      params.push(status);
    }

    queryStr += ` ORDER BY o.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const rows = await getAll(queryStr, params);

    // Enrich orders with menu items
    const enrichedRows = await Promise.all(
      rows.map(async (order: any) => {
        try {
          const items = await query(
            `SELECT mi.name, oi.quantity
             FROM order_items oi
             LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
             WHERE oi.order_id = $1
             LIMIT 2`,
            [order.id]
          );
          return {
            ...order,
            total_amount: Number(order.total_amount),
            menu_items: items || [],
          };
        } catch (err) {
          console.error('Error fetching menu items for order:', order.id, err);
          return order;
        }
      })
    );

    return NextResponse.json(enrichedRows);
  } catch (error) {
    console.error('Failed to fetch orders:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
