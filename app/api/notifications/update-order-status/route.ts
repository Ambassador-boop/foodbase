import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, paymentStatus, onesignalNotificationId } = body;

    if (!orderId || !onesignalNotificationId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!ONESIGNAL_API_KEY) {
      console.error('[v0] OneSignal API key missing');
      return NextResponse.json(
        { error: 'OneSignal not configured' },
        { status: 500 }
      );
    }

    // Update notification message
    const updatePayload = {
      contents: {
        en: `Order ${orderId} - Payment Status: ${paymentStatus}`,
      },
    };

    const updateResponse = await fetch(
      `${ONESIGNAL_API_URL}/${onesignalNotificationId}?app_id=${process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Authorization: `Basic ${ONESIGNAL_API_KEY}`,
        },
        body: JSON.stringify(updatePayload),
      }
    );

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      console.error('[v0] OneSignal update error:', errorData);
      return NextResponse.json(
        { error: 'Failed to update notification', details: errorData },
        { status: 500 }
      );
    }

    // Update notification status in database
    try {
      await db.query(
        `UPDATE notifications SET message = $1, updated_at = NOW() WHERE order_id = $2`,
        [`Order ${orderId} - Payment Status: ${paymentStatus}`, orderId]
      );

      console.log('[v0] Notification updated in database for order:', orderId);
    } catch (dbError) {
      console.error('[v0] Failed to update notification in database:', dbError);
    }

    return NextResponse.json({
      success: true,
      message: 'Notification updated',
    });
  } catch (error) {
    console.error('[v0] Update notification error:', error);
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}
