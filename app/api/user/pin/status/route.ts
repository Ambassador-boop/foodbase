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

    // Check if user has a PIN set in businesses table
    const business = await getOne(
      `SELECT pin_set_at FROM businesses 
       WHERE owner_id = $1`,
      [userId]
    );

    return NextResponse.json(
      {
        hasPinSet: !!business?.pin_set_at,
        pinSetAt: business?.pin_set_at || null,
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
