import { NextRequest, NextResponse } from 'next/server';
import { getOne } from '@/lib/db';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
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
    const user = await getOne('SELECT preferred_auth_mode FROM users WHERE id = $1', [userId]);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        preferredAuthMode: user.preferred_auth_mode || 'sms',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] Auth mode check error:', error);
    return NextResponse.json(
      { error: 'Failed to check authentication mode' },
      { status: 500 }
    );
  }
}
