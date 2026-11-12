import { NextRequest, NextResponse } from 'next/server';
import { getActiveBusiness } from '@/lib/active-business';
import { describePushSoundConfig, pushSoundFields } from '@/lib/onesignal-sound';

/**
 * GET  /api/business/notifications/test   Is push configured, and with what sound?
 * POST /api/business/notifications/test   Send one real test push to this business.
 *
 * The test goes down the same road as a real alert: OneSignal, targeted by the
 * `business_id` tag that every owner device carries. If it arrives, the real ones
 * will arrive; if it does not, the settings screen can say why instead of leaving
 * the owner guessing.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ONESIGNAL_API_URL = 'https://onesignal.com/api/v1/notifications';
const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_REST_API_KEY;

export async function GET() {
  const business = await getActiveBusiness();
  if (!business) {
    return NextResponse.json({ error: 'Business not found' }, { status: 401 });
  }
  return NextResponse.json({
    configured: Boolean(ONESIGNAL_APP_ID && ONESIGNAL_API_KEY),
    sound: describePushSoundConfig(),
    business: { id: business.id, name: business.name },
  });
}

export async function POST(_request: NextRequest) {
  try {
    const business = await getActiveBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 401 });
    }

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
      return NextResponse.json(
        {
          error:
            'Push is not configured on this deployment. Set NEXT_PUBLIC_ONESIGNAL_APP_ID and ONESIGNAL_REST_API_KEY to send real alerts.',
          code: 'not_configured',
        },
        { status: 503 },
      );
    }

    const response = await fetch(ONESIGNAL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        Authorization: `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id: ONESIGNAL_APP_ID,
        headings: { en: 'Test alert' },
        contents: { en: `${business.name}: this is how a paid order will sound.` },
        data: { type: 'test', targetUrl: '/dashboard/notifications' },
        filters: [{ field: 'tag', key: 'business_id', value: business.id }],
        priority: 10,
        ...pushSoundFields(),
      }),
    });

    const json: any = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[notifications] test push rejected', json);
      return NextResponse.json(
        {
          error:
            'OneSignal rejected the test. Check the app id, the REST API key and that this device has allowed notifications.',
          code: 'rejected',
          detail: json?.errors ?? null,
        },
        { status: 502 },
      );
    }

    const recipients = typeof json?.recipients === 'number' ? json.recipients : null;
    return NextResponse.json({
      sent: true,
      recipients,
      notificationId: json?.id ?? null,
      // An accepted request with zero recipients means no device carries this
      // business's tag yet. Say so instead of pretending it was delivered.
      deliveredToDevice: recipients === null ? null : recipients > 0,
    });
  } catch (error) {
    console.error('[notifications] test push failed', error);
    return NextResponse.json({ error: 'The test could not be sent.' }, { status: 500 });
  }
}
