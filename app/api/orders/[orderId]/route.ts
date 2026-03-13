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
    console.log('[v0] API: Fetching order with ID:', orderId);
    
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

    console.log('[v0] API: Order result:', orderResult);

    if (!orderResult || orderResult.length === 0) {
      console.log('[v0] API: Order not found for ID:', orderId);
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const order = orderResult[0];
    console.log('[v0] API: Order found:', order.id);

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

    console.log('[v0] API: Items result count:', itemsResult?.length || 0);

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

    // Calculate totals
    const subtotal = items.reduce((total, item) => {
      const basePrice = item.item_price / item.quantity; // Get per-unit price
      const addonTotal = item.addons?.reduce((sum: number, addon: any) => sum + (parseFloat(addon.price) || 0), 0) || 0;
      return total + (basePrice + addonTotal) * item.quantity;
    }, 0);

    const serviceFee = Math.round(subtotal * 0.075 * 100) / 100; // 7.5% service fee
    const total = subtotal + serviceFee;

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
