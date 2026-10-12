import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAndSendRefund } from '@/lib/refunds';

export async function POST(request: NextRequest, { params }: { params: Promise<{ refundId: string }> }) {
  try {
    const token = request.cookies.get('auth_token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyJWT(token);
    if (!user) return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 });
    const userId = (user as any).userId || (user as any).id;
    const refundId = (await params).refundId;
    const raw: any = await db.query(`SELECT r.id,r.order_id,r.refund_amount,r.amount,r.status,r.reason,r.notes FROM refunds r JOIN orders o ON o.id=r.order_id JOIN businesses b ON b.id=o.business_id WHERE r.id=$1 AND b.owner_id=$2`, [refundId, userId]);
    const refund = (Array.isArray(raw) ? raw : raw?.rows ?? [])[0];
    if (!refund) return NextResponse.json({ error: 'Refund not found or not authorized' }, { status: 404 });
    if (String(refund.status).toLowerCase() !== 'failed') return NextResponse.json({ error: 'Can only retry failed refunds' }, { status: 400 });
    await db.query('SELECT fb_reverse_failed_refund($1)', [refundId]);
    const result = await createAndSendRefund({ orderId: refund.order_id, ownerId: userId, amount: Number(refund.refund_amount ?? refund.amount), reason: refund.reason, notes: refund.notes });
    return NextResponse.json({ success: result.statusCode < 300, refundId: result.response.refundId, status: result.response.status, ...(result.response.error ? { error: result.response.error } : {}) }, { status: result.statusCode });
  } catch (error) {
    console.error('[v0] Refund retry failed:', error);
    return NextResponse.json({ error: 'Failed to retry refund' }, { status: 500 });
  }
}
