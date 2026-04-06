import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getOne } from '@/lib/db';

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

    // Count unread notifications
    const result = await getOne(
      `SELECT COUNT(*) as count
       FROM notifications
       WHERE business_id = $1
       AND is_read = false`,
      [businessData.id]
    );

    return NextResponse.json({
      unreadCount: parseInt(result?.count || 0) || 0,
    });
  } catch (error) {
    console.error('Notification count error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification count' },
      { status: 500 }
    );
  }
}
