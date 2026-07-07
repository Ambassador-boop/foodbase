import { NextRequest, NextResponse } from 'next/server';
import { getOne, query } from '@/lib/db';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { newMode } = await request.json();

    if (!newMode || !['email', 'sms', 'pin'].includes(newMode)) {
      return NextResponse.json(
        { error: 'Invalid authentication mode' },
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

    // Get user
    const user = await getOne('SELECT * FROM users WHERE id = $1', [userId]);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update preferred auth mode for user
    await query(
      'UPDATE users SET preferred_auth_mode = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newMode, userId]
    );

    // Also update preferred auth mode for ALL businesses belonging to this user
    await query(
      'UPDATE businesses SET preferred_auth_mode = $1 WHERE user_id = $2',
      [newMode, userId]
    );

    return NextResponse.json(
      {
        success: true,
        message: `Authentication mode changed to ${newMode}`,
        preferredAuthMode: newMode,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] Auth mode change error:', error);
    return NextResponse.json(
      { error: 'Failed to change authentication mode' },
      { status: 500 }
    );
  }
}
