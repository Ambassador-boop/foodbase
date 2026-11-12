import { NextRequest, NextResponse } from 'next/server';
import { db, query } from '@/lib/db';
import { getSchemaSupport } from '@/lib/delivery/storage';

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

    // Batch 3B columns are read only when the migration has run, so this
    // endpoint keeps working unchanged on a pre-3B database.
    const support = await getSchemaSupport();
    const extraColumns = [
      support.orderDelivery
        ? 'o.delivery_fee, o.delivery_area_id, o.delivery_lat, o.delivery_lng, o.estimated_delivery_minutes, o.delivery_address_text'
        : null,
      support.orderTableLabel ? 'o.table_label' : null,
    ]
      .filter(Boolean)
      .join(', ');

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
        o.completed_at${extraColumns ? `,
        ${extraColumns}` : ''},
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

    // Fetch order items with menu item or drink details
    const itemsResult = await query(
      `SELECT 
        oi.id,
        oi.menu_item_id,
        oi.quantity,
        oi.item_price,
        oi.configuration,
        COALESCE(mi.name, d.name) as menu_item_name,
        COALESCE(mi.description, d.description) as menu_item_description,
        COALESCE(mi.image_url, d.image_url) as menu_item_image,
        CASE WHEN d.id IS NOT NULL THEN 'drink' ELSE 'menu' END as item_type
      FROM order_items oi
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      LEFT JOIN drinks d ON oi.menu_item_id = d.id
      WHERE oi.order_id = $1
      ORDER BY oi.created_at ASC`,
      [orderId]
    );

    // Process items and parse addon configuration
    const items = (itemsResult || []).map((item: any) => {
      let addons = [];
      let isFromConfig = false;
      if (item.configuration) {
        try {
          const parsedConfig = Array.isArray(item.configuration) ? item.configuration : JSON.parse(item.configuration);
          if (Array.isArray(parsedConfig)) {
            addons = parsedConfig;
          } else if (typeof parsedConfig === 'object') {
            // If it's an object with item_type, extract addons array
            addons = parsedConfig.addons || parsedConfig || [];
          }
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
    // item_price is the BASE per-unit price; add-ons live in `addons` and
    // are summed on top. subtotal = (base + per-unit addon sum) * qty.
    const subtotal = items.reduce((total: number, item: any) => {
      const addonsPerUnit = Array.isArray(item.addons)
        ? item.addons.reduce(
            (s: number, a: any) => s + (Number(a?.price) || 0),
            0
          )
        : 0;
      return total + (Number(item.item_price) + addonsPerUnit) * item.quantity;
    }, 0);

    const total = parseFloat(order.total_amount) || subtotal;
    const storedServiceFee = parseFloat(order.service_fee_amount);
    // Batch 3B: the delivery fee is a stored fact, so it is never inferred from
    // whatever is left over in the total.
    const deliveryFee = support.orderDelivery ? parseFloat(order.delivery_fee) || 0 : 0;
    const serviceFee = Number.isFinite(storedServiceFee)
      ? storedServiceFee
      : Math.max(0, total - subtotal - deliveryFee);

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
        // Batch 3B, additive. Null on orders placed before this batch.
        table_label: support.orderTableLabel ? order.table_label ?? null : null,
        delivery_fee: support.orderDelivery ? deliveryFee : null,
        delivery_area_id: support.orderDelivery ? order.delivery_area_id ?? null : null,
        delivery_lat: support.orderDelivery ? order.delivery_lat ?? null : null,
        delivery_lng: support.orderDelivery ? order.delivery_lng ?? null : null,
        delivery_address_text: support.orderDelivery ? order.delivery_address_text ?? null : null,
        estimated_delivery_minutes: support.orderDelivery
          ? order.estimated_delivery_minutes ?? null
          : null,
      },
      items,
      calculations: {
        subtotal: Math.round(subtotal * 100) / 100,
        serviceFee: serviceFee,
        deliveryFee: Math.round(deliveryFee * 100) / 100,
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
