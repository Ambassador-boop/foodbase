import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAll } from '@/lib/db';
import { getActiveBusiness } from '@/lib/active-business';

export async function GET(_request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await getActiveBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const notifications = await getAll(
      `SELECT *
         FROM notifications
        WHERE business_id = $1
        ORDER BY created_at DESC`,
      [business.id],
    );

    return NextResponse.json({ notifications: notifications || [] });
  } catch (error) {
    console.error('Notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 },
    );
  }
}
