import { NextRequest, NextResponse } from 'next/server';
import { getOne, query } from '@/lib/db';
import { headers } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { newMode } = await request.json();

    if (!newMode || !['email', 'sms', 'pin'].includes(newMode)) {
      return NextResponse.json(
        { error: 'Invalid authentication mode' },
        { status: 400 }
      );
    }

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
    const user = await getOne('SELECT * FROM users WHERE id = $1', [userId]);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update preferred auth mode
    await query(
      'UPDATE users SET preferred_auth_mode = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
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
