import { NextResponse } from 'next/server';
import { getActiveBusiness } from '@/lib/active-business';

export async function GET() {
  try {
    const business = await getActiveBusiness();

    if (!business) {
      return NextResponse.json(
        { error: 'No active business found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ businessId: business.id });
  } catch (error) {
    console.error('[v0] Current business fetch error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
