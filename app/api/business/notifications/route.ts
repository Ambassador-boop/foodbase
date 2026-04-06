import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getOne, getAll } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get businessId from query params or use the first one
    const { searchParams } = new URL(request.url);
    let businessId = searchParams.get('businessId');

    if (!businessId) {
      const businessData = await getOne(
        'SELECT id FROM businesses WHERE owner_id = $1 LIMIT 1',
        [currentUser.id]
      );
      if (!businessData) {
        return NextResponse.json({ error: 'Business not found' }, { status: 404 });
      }
      businessId = businessData.id;
    }

    // Verify the business belongs to the current user
    const businessData = await getOne(
      'SELECT id FROM businesses WHERE id = $1 AND owner_id = $2',
      [businessId, currentUser.id]
    );

    if (!businessData) {
      return NextResponse.json({ error: 'Business not found or unauthorized' }, { status: 404 });
    }

    // Get notifications
    const notifications = await getAll(
      `SELECT *
       FROM notifications
       WHERE business_id = $1
       ORDER BY created_at DESC`,
      [businessId]
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
