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
  business_id: string;
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
      'SELECT id, business_id, customer_name, customer_email, customer_phone, payment_status, address, notes, total_amount, created_at FROM orders WHERE id = $1',
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

    return {
      order: order as Order,
      items: items as OrderItem[],
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

/**
 * Send new order notification to business owner
 * Called automatically when order is created
 */
export async function sendNewOrderNotification(
  orderId: string,
  businessId: string,
  customerName?: string
): Promise<boolean> {
  try {
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
      console.error('[v0] OneSignal credentials missing');
      return false;
    }

    // Fetch complete order details
    const orderData = await getOrderDetails(orderId);
    if (!orderData) {
      console.error('[v0] Order not found:', orderId);
      return false;
    }

    const { order, items } = orderData;

    // Build rich notification content
    const itemsSummary = formatOrderItems(items);
    const notificationTitle = `New Order from ${order.customer_name}`;
    const notificationBody = `Order #${orderId.slice(0, 8)} - ${itemsSummary}`;
    const shortBody = `Order #${orderId.slice(0, 8)} - $${order.total_amount.toFixed(2)} - ${order.payment_status}`;

    console.log('[v0] Building new order notification:', {
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
    const notificationPayload = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: notificationTitle },
      contents: {
        en: shortBody,
      },
      data: notificationData,
      filters: [
        { field: 'tag', key: 'business_id', value: businessId },
      ],
      android_channel_id: 'order_notifications',
      priority: 10,
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
      return false;
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

    console.log('[v0] New order notification sent successfully:', onesignalData.id);
    return true;
  } catch (error) {
    console.error('[v0] Error sending new order notification:', error);
    return false;
  }
}

/**
 * Send order status update notification to business owner
 * Called when payment is completed or order status changes
 */
export async function sendOrderStatusNotification(
  orderId: string,
  status: string,
  paymentStatus: string
): Promise<boolean> {
  try {
    if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
      console.error('[v0] OneSignal credentials missing');
      return false;
    }

    // Fetch order details
    const order = await getOne(
      'SELECT id, business_id, customer_name, payment_status, status, total_amount FROM orders WHERE id = $1',
      [orderId]
    );

    if (!order) {
      console.error('[v0] Order not found for status update:', orderId);
      return false;
    }

    // Get human-readable status display name
    const statusMap: Record<string, string> = {
      pending: 'Pending Preparation',
      preparing: 'Being Prepared',
      ready: 'Ready for Pickup',
      out_for_delivery: 'Out for Delivery',
      completed: 'Completed',
      cancelled: 'Cancelled',
      confirmed: 'Confirmed',
    };
    const statusDisplay = statusMap[status] || status;

    const notificationTitle = 'Order Status Update';
    const notificationBody = `Order #${orderId.slice(0, 8)} - ${statusDisplay} - ${paymentStatus}`;

    console.log('[v0] Building status update notification:', {
      orderId,
      newStatus: status,
      paymentStatus,
      customerName: order.customer_name,
    });

    // Build notification data payload
    const notificationData = {
      orderId,
      type: 'order_status_update',
      targetUrl: `/dashboard/orders/${orderId}`,
      status,
      paymentStatus,
      customerName: order.customer_name,
    };

    // Send new notification
    const notificationPayload = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: notificationTitle },
      contents: {
        en: notificationBody,
      },
      data: notificationData,
      filters: [
        { field: 'tag', key: 'business_id', value: order.business_id },
      ],
      android_channel_id: 'order_status_updates',
      priority: 10,
    };

    console.log('[v0] Sending status update notification...');
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
      return false;
    }

    // Create new notification record in database for status update
    const notificationId = generateAlphanumericId();
    try {
      await db.query(
        `INSERT INTO notifications 
        (id, order_id, business_id, notification_title, notification_body, onesignal_notification_id, payment_status, customer_name, created_at, updated_at, is_read)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), false)`,
        [
          notificationId,
          orderId,
          order.business_id,
          notificationTitle,
          notificationBody,
          onesignalData.id || onesignalData.body?.notification_id,
          paymentStatus,
          order.customer_name,
        ]
      );

      console.log('[v0] Status update notification recorded:', notificationId);
    } catch (dbError) {
      console.error('[v0] Failed to record status notification:', dbError);
      // Don't fail if database insert fails
    }

    console.log('[v0] Status update notification sent successfully:', onesignalData.id);
    return true;
  } catch (error) {
    console.error('[v0] Error sending status update notification:', error);
    return false;
  }
}
