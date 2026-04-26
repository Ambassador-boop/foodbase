import { NextRequest, NextResponse } from 'next/server';
import { db, query } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const resolvedParams = await params;
    const orderId = resolvedParams.orderId;

    if (!orderId) {
      return NextResponse.json(
        { error: 'Order ID is required' },
        { status: 400 }
      );
    }

    // Fetch complete order data with order items
    const orderResult = await query(
      `SELECT 
        o.id,
        o.business_id,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        o.address,
        o.status,
        o.payment_status,
        o.total_amount,
        o.service_fee_amount,
        o.notes,
        o.created_at,
        o.completed_at,
        b.name as business_name,
        b.logo_url
      FROM orders o
      LEFT JOIN businesses b ON o.business_id = b.id
      WHERE o.id = $1`,
      [orderId]
    );

    if (!orderResult || orderResult.length === 0) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const order = orderResult[0];

    // Fetch order items with menu item details
    const itemsResult = await query(
      `SELECT 
        oi.id,
        oi.menu_item_id,
        oi.quantity,
        oi.item_price,
        oi.configuration,
        mi.name as menu_item_name,
        mi.description as menu_item_description,
        mi.image_url as menu_item_image
      FROM order_items oi
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE oi.order_id = $1
      ORDER BY oi.created_at ASC`,
      [orderId]
    );

    // Process items and parse addon configuration
    const items = (itemsResult || []).map((item: any) => {
      let addons = [];
      if (item.configuration) {
        try {
          addons = Array.isArray(item.configuration) ? item.configuration : JSON.parse(item.configuration);
        } catch {
          addons = [];
        }
      }

      return {
        id: item.id,
        menu_item_id: item.menu_item_id,
        menu_item_name: item.menu_item_name,
        menu_item_description: item.menu_item_description,
        menu_item_image: item.menu_item_image,
        quantity: item.quantity,
        item_price: parseFloat(item.item_price) || 0,
        addons: addons,
      };
    });

    // Use the stored service fee from the order, not a recomputed 7.5%.
    // item_price is the per-unit price that already includes the per-unit
    // sum of addon prices, so subtotal is item_price * quantity per row.
    const subtotal = items.reduce((total, item) => {
      return total + item.item_price * item.quantity;
    }, 0);

    const total = parseFloat(order.total_amount) || subtotal;
    const serviceFee = parseFloat(order.service_fee_amount) || Math.max(0, total - subtotal);

    return NextResponse.json({
      order: {
        id: order.id,
        business_id: order.business_id,
        business_name: order.business_name,
        logo_url: order.logo_url,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        address: order.address,
        status: order.status,
        payment_status: order.payment_status,
        notes: order.notes,
        created_at: order.created_at,
        completed_at: order.completed_at,
      },
      items,
      calculations: {
        subtotal: Math.round(subtotal * 100) / 100,
        serviceFee: serviceFee,
        total: Math.round(total * 100) / 100,
      },
    });
  } catch (error) {
    console.error('[v0] Order details API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch order details' },
      { status: 500 }
    );
  }
}
