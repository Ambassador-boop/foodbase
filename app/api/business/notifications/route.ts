import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getOne, getAll } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get business
    const businessData = await getOne(
      'SELECT * FROM businesses WHERE owner_id = $1 LIMIT 1',
      [currentUser.id]
    );

    if (!businessData) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Get notifications
    const notifications = await getAll(
      `SELECT *
       FROM notifications
       WHERE business_id = $1
       ORDER BY created_at DESC`,
      [businessData.id]
    );

    return NextResponse.json({ notifications: notifications || [] });
  } catch (error) {
    console.error('Notifications error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 }
    );
  }
}
