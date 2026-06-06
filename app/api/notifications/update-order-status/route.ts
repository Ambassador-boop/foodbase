import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getOne } from '@/lib/db';
import { generateAlphanumericId } from '@/lib/utils';

const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';
const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

interface Order {
  id: string;
  business_id: string;
  customer_name: string;
  payment_status: string;
  status: string;
  total_amount: number;
}

/**
 * Fetch order details for status update notification
 */
async function getOrderForStatusUpdate(orderId: string): Promise<Order | null> {
  try {
    const order = await getOne(
      'SELECT id, business_id, customer_name, payment_status, status, total_amount FROM orders WHERE id = $1',
      [orderId]
    );
    return order as Order | null;
  } catch (error) {
    console.error('[v0] Error fetching order:', error);
    return null;
  }
}

/**
 * Get human-readable status display name
 */
function getStatusDisplayName(status: string): string {
  const statusMap: Record<string, string> = {
    pending: 'Pending Preparation',
    preparing: 'Being Prepared',
    ready: 'Ready for Pickup',
    out_for_delivery: 'Out for Delivery',
    completed: 'Completed',
    cancelled: 'Cancelled',
  };
  return statusMap[status] || status;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, status, paymentStatus } = body;

    if (!orderId || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: orderId, status' },
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

    // Fetch order details
    const order = await getOrderForStatusUpdate(orderId);
    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    const statusDisplay = getStatusDisplayName(status);
    const paymentDisplay = paymentStatus || order.payment_status;
    
    // Build notification content for status update
    const notificationTitle = `Order Status Update`;
    const notificationBody = `Order #${orderId.slice(0, 8)} - ${statusDisplay} - ${paymentDisplay}`;

    console.log('[v0] Building status update notification:', {
      orderId,
      newStatus: status,
      paymentStatus: paymentDisplay,
      customerName: order.customer_name,
    });

    // Build notification data payload
    const notificationData = {
      orderId,
      type: 'order_status_update',
      targetUrl: `/dashboard/orders/${orderId}`,
      status,
      paymentStatus: paymentDisplay,
      customerName: order.customer_name,
    };

    // Send new notification instead of updating existing
    // This creates a fresh notification that appears on the device
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
      return NextResponse.json(
        { error: 'Failed to send notification', details: onesignalData },
        { status: 500 }
      );
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
          paymentDisplay,
          order.customer_name,
        ]
      );

      console.log('[v0] Status update notification recorded:', notificationId);
    } catch (dbError) {
      console.error('[v0] Failed to record status notification:', dbError);
      // Don't fail if database insert fails
    }

    return NextResponse.json({
      success: true,
      notificationId: onesignalData.id || onesignalData.body?.notification_id,
      orderId,
      message: 'Status update notification sent successfully',
    });
  } catch (error) {
    console.error('[v0] Status update notification error:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
