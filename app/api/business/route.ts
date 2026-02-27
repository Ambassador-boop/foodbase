import { NextRequest, NextResponse } from 'next/server';
import { getOne } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get business details
    const business = await getOne(
      'SELECT * FROM businesses WHERE owner_id = $1',
      [currentUser.id]
    );

    if (!business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      business,
    });
  } catch (error) {
    console.error('[v0] Get business error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch business' },
      { status: 500 }
    );
  }
}
