import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getOne } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { isRead } = body;

    // Get business
    const businessData = await getOne(
      'SELECT * FROM businesses WHERE owner_id = $1 LIMIT 1',
      [currentUser.id]
    );

    if (!businessData) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Verify notification belongs to user's business
    const notification = await getOne(
      'SELECT * FROM notifications WHERE id = $1 AND business_id = $2',
      [id, businessData.id]
    );

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    // Update notification
    await getOne(
      'UPDATE notifications SET is_read = $1, updated_at = NOW() WHERE id = $2',
      [isRead, id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notification update error:', error);
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    // Get business
    const businessData = await getOne(
      'SELECT * FROM businesses WHERE owner_id = $1 LIMIT 1',
      [currentUser.id]
    );

    if (!businessData) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Verify notification belongs to user's business
    const notification = await getOne(
      'SELECT * FROM notifications WHERE id = $1 AND business_id = $2',
      [id, businessData.id]
    );

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    // Delete notification
    await getOne('DELETE FROM notifications WHERE id = $1', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Notification delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification' },
      { status: 500 }
    );
  }
}
