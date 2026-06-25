import { NextRequest, NextResponse } from 'next/server';
import { getOne } from '@/lib/db';
import { headers } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    // Get user from session
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    let userId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      try {
        const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        userId = decoded.sub || decoded.userId;
      } catch {
        // Token parsing failed
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
