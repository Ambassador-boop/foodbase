import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getOne } from '@/lib/db';

const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';
const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

/**
 * POST /api/orders/notify?orderId=<orderId>
 * Manually send or resend a notification for an order
 * Useful for manual triggers or resending notifications
 */
export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('orderId');
    const notificationType = searchParams.get('type') || 'manual'; // 'manual', 'reminder', 'status'

    if (!orderId) {
      return NextResponse.json(
        { error: 'Missing orderId query parameter' },
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
    const order = await getOne(
      `SELECT o.id, o.business_id, o.customer_name, o.payment_status, o.status, o.total_amount
       FROM orders o
       WHERE o.id = $1`,
      [orderId]
    );

    if (!order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 }
      );
    }

    // Determine notification title and body based on type
    let notificationTitle = 'Order Notification';
    let notificationBody = `Order #${orderId.slice(0, 8)}`;
    let notificationData: Record<string, string> = {
      orderId,
      type: notificationType,
      targetUrl: `/dashboard/orders/${orderId}`,
      customerName: order.customer_name,
    };

    if (notificationType === 'reminder') {
      notificationTitle = 'Order Reminder';
      notificationBody = `Reminder: Order #${orderId.slice(0, 8)} from ${order.customer_name}`;
      notificationData.reminderType = 'pending_action';
    } else if (notificationType === 'status') {
      notificationTitle = 'Order Status Update';
      notificationBody = `Order #${orderId.slice(0, 8)} - ${order.status} (${order.payment_status})`;
    } else {
      notificationTitle = 'Manual Notification';
      notificationBody = `Order #${orderId.slice(0, 8)} - Total: $${order.total_amount.toFixed(2)}`;
    }

    console.log('[v0] Sending manual notification:', {
      orderId,
      type: notificationType,
      customerName: order.customer_name,
    });

    // Send notification
    const notificationPayload = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: notificationTitle },
      contents: { en: notificationBody },
      data: notificationData,
      filters: [
        { field: 'tag', key: 'business_id', value: order.business_id },
      ],
      priority: 10,
    };

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

    console.log('[v0] Manual notification sent:', onesignalData.id);

    return NextResponse.json({
      success: true,
      message: `${notificationType} notification sent`,
      notificationId: onesignalData.id || onesignalData.body?.notification_id,
      orderId,
    });
  } catch (error) {
    console.error('[v0] Manual notification error:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
