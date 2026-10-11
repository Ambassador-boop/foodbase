import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getOne } from '@/lib/db';

/**
 * POST /api/save-push-token
 * Saves OneSignal device token and associates it with the logged-in user
 * Called after OneSignal initialization on login
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { oneSignalUserId, externalId, email } = body;

    if (!oneSignalUserId || !externalId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: oneSignalUserId, externalId, email' },
        { status: 400 }
      );
    }

  
    // Get user ID from email
    const user = await getOne(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (!user) {
      console.error('[v0] User not found:', email);
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get business ID for business owners
    let businessId: string | undefined;
    if (user.role === 'business_owner') {
      const business = await getOne(
        'SELECT id FROM businesses WHERE owner_id = $1',
        [user.id]
      );
      businessId = business?.id;
    }

    // Store the OneSignal user ID - you might want to create a device_tokens table
    // For now, we'll add this info to the notification payload when sending
    // In production, you might want to store this in a dedicated table like:
    // CREATE TABLE device_tokens (
    //   id UUID PRIMARY KEY,
    //   user_id UUID NOT NULL,
    //   business_id UUID,
    //   onesignal_user_id TEXT NOT NULL,
    //   external_id TEXT NOT NULL,
    //   created_at TIMESTAMP DEFAULT NOW(),
    //   updated_at TIMESTAMP DEFAULT NOW()
    // );

    // For now, we'll log this for internal use
    console.log('[v0] Push token saved:', {
      userId: user.id,
      businessId,
      oneSignalUserId,
      externalId: externalId, // User's email
    });

    return NextResponse.json({
      success: true,
      message: 'Push token saved successfully',
      userId: user.id,
      businessId,
    });
  } catch (error) {
    console.error('[v0] Save push token error:', error);
    return NextResponse.json(
      { error: 'Failed to save push token' },
      { status: 500 }
    );
  }
}
