import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || user.role !== 'business_owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const resolvedParams = await params;
    const orderId = resolvedParams.orderId;
    const { status } = await request.json();

    if (!status) {
      return NextResponse.json({ error: 'Status is required' }, { status: 400 });
    }

    const validStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    // Verify order belongs to user's business
    const orderResult = await db(
      `SELECT o.id FROM orders o
       JOIN businesses b ON o.business_id = b.id
       WHERE o.id = $1 AND b.owner_id = $2`,
      [orderId, user.userId || user.id]
    );

    if (!orderResult || orderResult.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Update status
    const completedAt = status === 'completed' ? new Date().toISOString() : null;
    await db(
      `UPDATE orders SET status = $1, completed_at = $2 WHERE id = $3`,
      [status, completedAt, orderId]
    );

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('Failed to update order status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
