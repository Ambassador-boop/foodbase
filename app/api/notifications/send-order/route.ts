import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateAlphanumericId } from '@/lib/utils';

const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';
const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, customerId, customerName, businessId, paymentStatus } = body;

    if (!orderId || !customerName || !businessId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
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

    // Send OneSignal notification
    const notificationPayload = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: 'New Order' },
      contents: {
        en: `New order from ${customerName} - Payment Status: ${paymentStatus || 'pending'}`,
      },
      data: {
        orderId,
        customerId: customerId || '',
        type: 'order_notification',
      },
      // Send to business owner (you might want to use filters or segments)
      filters: [
        { field: 'tag', key: 'business_id', value: businessId },
      ],
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

    // Store notification record in database
    const notificationId = generateAlphanumericId();
    try {
      await db.query(
        `INSERT INTO notifications 
        (id, order_id, business_id, notification_title, notification_body, onesignal_notification_id, payment_status, customer_name, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          notificationId,
          orderId,
          businessId,
          'New Order Received',
          `New order from ${customerName} - Payment Status: ${paymentStatus || 'pending'}`,
          onesignalData.id,
          paymentStatus || 'pending',
          customerName,
        ]
      );

      console.log('[v0] Notification recorded in database:', notificationId);
    } catch (dbError) {
      console.error('[v0] Failed to record notification in database:', dbError);
      // Don't fail if database insert fails
    }

    return NextResponse.json({
      success: true,
      notificationId: onesignalData.id,
    });
  } catch (error) {
    console.error('[v0] Send notification error:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}
