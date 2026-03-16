import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { verifyJWT, getAuthCookie } from '@/lib/auth';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    // Try to get token from Authorization header first (for API calls with Bearer token)
    let token = request.headers.get('authorization')?.replace('Bearer ', '');
    
    // If no token in header, try to get from cookies (for server-side requests)
    if (!token) {
      const authCookie = request.cookies.get('auth_token')?.value;
      token = authCookie;
    }
    
    if (!token) {
      return NextResponse.json({ error: 'No auth token found' }, { status: 401 });
    }

    const user = await verifyJWT(token);
    
    if (!user || (user as any).role !== 'business_owner') {
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
    const userId = (user as any).userId || (user as any).id;

    const orderResult = await query(
      `SELECT o.id FROM orders o
       JOIN businesses b ON o.business_id = b.id
       WHERE o.id = $1 AND b.owner_id = $2`,
      [orderId, userId]
    );

    if (!orderResult || orderResult.length === 0) {
      return NextResponse.json({ error: 'Order not found or not authorized' }, { status: 404 });
    }

    // Update status
    const completedAt = status === 'completed' ? new Date().toISOString() : null;

    const updateResult = await query(
      `UPDATE orders SET status = $1, completed_at = $2, updated_at = NOW() WHERE id = $3 RETURNING business_id, customer_name, payment_status`,
      [status, completedAt, orderId]
    );

    // Send notification if status changes
    if (updateResult && updateResult.length > 0) {
      const { business_id, customer_name, payment_status } = updateResult[0];
      try {
        await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/send-order`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              orderId,
              customerName: customer_name,
              businessId: business_id,
              paymentStatus: payment_status,
            }),
          }
        );
      } catch (notificationError) {
        console.error('[v0] Error sending status notification:', notificationError);
      }
    }

    return NextResponse.json({ success: true, status });
  } catch (error) {
    console.error('Status API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
