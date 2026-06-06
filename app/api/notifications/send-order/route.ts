import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getOne } from '@/lib/db';
import { generateAlphanumericId } from '@/lib/utils';

const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';
const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  item_price: number;
}

interface Order {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  payment_status: string;
  address: string;
  notes: string;
  total_amount: number;
  created_at: string;
}

/**
 * Fetch complete order details with menu items and prices
 */
async function getOrderDetails(orderId: string): Promise<{ order: Order; items: OrderItem[] } | null> {
  try {
    const order = await getOne(
      'SELECT id, customer_name, customer_email, customer_phone, payment_status, address, notes, total_amount, created_at FROM orders WHERE id = $1',
      [orderId]
    );

    if (!order) {
      return null;
    }

    // Get order items with menu item details
    const itemsResult = await db.query(
      `SELECT 
        oi.id, 
        mi.name, 
        oi.quantity, 
        oi.item_price
      FROM order_items oi
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE oi.order_id = $1
      ORDER BY oi.created_at ASC`,
      [orderId]
    );

    // db.query returns rows directly as an array
    const items = Array.isArray(itemsResult) ? itemsResult : (itemsResult?.rows || []);

    // Normalize numeric values from database (they come back as strings)
    const normalizedOrder = {
      ...order,
      total_amount: Number(order.total_amount) || 0,
    };

    const normalizedItems = items.map((item: any) => ({
      ...item,
      quantity: Number(item.quantity) || 0,
      item_price: Number(item.item_price) || 0,
    }));

    return {
      order: normalizedOrder as Order,
      items: normalizedItems as OrderItem[],
    };
  } catch (error) {
    console.error('[v0] Error fetching order details:', error);
    return null;
  }
}

/**
 * Format order items for notification display
 */
function formatOrderItems(items: OrderItem[]): string {
  if (!items || items.length === 0) {
    return 'Order items';
  }
  return items
    .map((item) => `${item.name} x${item.quantity} ($${(item.item_price * item.quantity).toFixed(2)})`)
    .join('; ');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, businessId } = body;

    if (!orderId || !businessId) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId, businessId' },
        { status: 400 }
      );
    }

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
      console.error('[v0] OneSignal credentials missing');
      return NextResponse.json(
        { error: 'OneSignal not configured' },
        { status: 500 }
      );
    }

    // Fetch complete order details
    const orderData = await getOrderDetails(orderId);
    if (!orderData) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const { order, items } = orderData;

    // Ensure total_amount is a number for formatting
    const totalAmount = Number(order.total_amount) || 0;

    // Build rich notification content
    const itemsSummary = formatOrderItems(items);
    const notificationTitle = `New Order from ${order.customer_name}`;
    const notificationBody = `Order #${orderId.slice(0, 8)} - ${itemsSummary}`;
    const shortBody = `Order #${orderId.slice(0, 8)} - $${totalAmount.toFixed(2)} - ${order.payment_status}`;

    console.log('[v0] Building notification:', {
      orderId,
      customerName: order.customer_name,
      itemCount: items.length,
      totalAmount: order.total_amount,
      paymentStatus: order.payment_status,
    });

    // Build notification data payload for navigation
    const notificationData = {
      orderId,
      type: 'new_order',
      targetUrl: `/dashboard/orders/${orderId}`,
      customerName: order.customer_name,
      paymentStatus: order.payment_status,
      totalAmount: order.total_amount.toString(),
      itemCount: items.length.toString(),
    };

    // Send OneSignal notification via REST API
    // Using segments instead of filters for better targeting
    const notificationPayload = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: notificationTitle },
      contents: {
        en: shortBody,
      },
      big_picture: undefined, // Optional: can add order image
      large_icon: undefined, // Optional: can add restaurant logo
      data: notificationData,
      // Target business owner by business_id tag
      filters: [
        { field: 'tag', key: 'business_id', value: businessId },
      ],
      // Add Android-specific options
      android_channel_id: 'order_notifications',
      priority: 10, // High priority for order notifications
    };

    console.log('[v0] Sending OneSignal notification...');
    const onesignalResponse = await fetch(ONESIGNAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify(notificationPayload),
    });

    const onesignalData = await onesignalResponse.json();

    if (!onesignalResponse.ok) {
      console.error('[v0] OneSignal error:', onesignalData);
      return NextResponse.json(
        { error: 'Failed to send notification', details: onesignalData },
        { status: 500 }
      );
    }

    // Store notification record in database
    const notificationId = generateAlphanumericId();
    try {
      await db.query(
        `INSERT INTO notifications 
        (id, order_id, business_id, notification_title, notification_body, onesignal_notification_id, payment_status, customer_name, created_at, updated_at, is_read)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), false)`,
        [
          notificationId,
          orderId,
          businessId,
          notificationTitle,
          notificationBody,
          onesignalData.id || onesignalData.body?.notification_id,
          order.payment_status,
          order.customer_name,
        ]
      );

      console.log('[v0] Notification recorded in database:', notificationId);
    } catch (dbError) {
      console.error('[v0] Failed to record notification in database:', dbError);
      // Don't fail if database insert fails
    }

    return NextResponse.json({
      success: true,
      notificationId: onesignalData.id || onesignalData.body?.notification_id,
      orderId,
      message: 'Order notification sent successfully',
    });
  } catch (error) {
    console.error('[v0] Send notification error:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
