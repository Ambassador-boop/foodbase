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

    // Check if user has a PIN set
    const userPin = await getOne(
      `SELECT created_at FROM pins 
       WHERE business_id = $1 AND purpose = 'user_security' AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    return NextResponse.json(
      {
        hasPinSet: !!userPin,
        pinSetAt: userPin?.created_at || null,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('[v0] PIN status check error:', error);
    return NextResponse.json(
      { error: 'Failed to check PIN status' },
      { status: 500 }
    );
  }
}
