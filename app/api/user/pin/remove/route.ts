import { NextRequest, NextResponse } from 'next/server';
import { getOne, query } from '@/lib/db';
import { comparePin } from '@/lib/pin-utils';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { pin } = await request.json();

    if (!pin) {
      return NextResponse.json(
        { error: 'PIN is required' },
        { status: 400 }
      );
    }

    // Get and verify token
    const token = await getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const verified = await verifyToken(token);
    if (!verified || !verified.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = verified.userId as string;

    // Get user's current PIN
    const userPin = await getOne(
      `SELECT * FROM pins 
       WHERE business_id = $1 AND purpose = 'user_security' AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (!userPin) {
      return NextResponse.json(
        { error: 'No PIN is currently set' },
        { status: 400 }
      );
    }

    // Verify PIN
    const isPinValid = await comparePin(pin, userPin.pin_hash);

    if (!isPinValid) {
      return NextResponse.json(
        { error: 'Invalid PIN' },
        { status: 401 }
      );
    }

    // Delete PIN record
    await query(
      `DELETE FROM pins WHERE id = $1`,
      [userPin.id]
    );

    // Update user auth mode to SMS (default)
    await query(
      'UPDATE users SET preferred_auth_mode = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['sms', userId]
    );

    return NextResponse.json(
      {
        success: true,
        message: 'PIN removed successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] PIN removal error:', error);
    return NextResponse.json(
      { error: 'Failed to remove PIN' },
      { status: 500 }
    );
  }
}
