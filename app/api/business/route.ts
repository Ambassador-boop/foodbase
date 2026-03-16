import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query, getAll } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (currentUser.role === 'business_owner') {
      // Get business info with financial data
      const businesses = await getAll(
        `SELECT id, name, slug, email, is_active, available_balance, pending_balance 
         FROM businesses WHERE owner_id = $1 ORDER BY created_at DESC`,
        [currentUser.id]
      );

      if (businesses && businesses.length > 0) {
        return NextResponse.json({
          success: true,
          business: businesses[0],
          businesses: businesses || [],
        });
      }
    }

    return NextResponse.json({
      success: true,
      business: null,
      businesses: [],
    });
  } catch (error) {
    console.error('[v0] Get business error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch business' },
      { status: 500 }
    );
  }
}
