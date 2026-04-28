import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getOne } from '@/lib/db';
import { getActiveBusiness } from '@/lib/active-business';

export async function GET(_request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await getActiveBusiness();
    if (!business) {
      return NextResponse.json({ unreadCount: 0 });
    }

    const result = await getOne(
      `SELECT COUNT(*) as count
         FROM notifications
        WHERE business_id = $1
          AND is_read = false`,
      [business.id],
    );

    return NextResponse.json({
      unreadCount: parseInt(result?.count || 0) || 0,
    });
  } catch (error) {
    console.error('Notification count error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification count' },
      { status: 500 },
    );
  }
}
