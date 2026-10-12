import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAndSendRefund } from '@/lib/refunds';
import { getActiveBusinessForUser } from '@/lib/active-business';
import { normalizeAmount, requireTicket } from '@/lib/security/pin';

export async function POST(request: NextRequest, { params }: { params: Promise<{ refundId: string }> }) {
  try {
    const token = request.cookies.get('auth_token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyJWT(token);
    if (!user) return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 });
    const userId = (user as any).userId || (user as any).id;
    const refundId = (await params).refundId;
    const body = await request.json();
    const raw: any = await db.query(`SELECT r.id,r.order_id,r.refund_amount,r.amount,r.status,r.reason,r.notes FROM refunds r JOIN orders o ON o.id=r.order_id JOIN businesses b ON b.id=o.business_id WHERE r.id=$1 AND b.owner_id=$2`, [refundId, userId]);
    const refund = (Array.isArray(raw) ? raw : raw?.rows ?? [])[0];
    if (!refund) return NextResponse.json({ error: 'Refund not found or not authorized' }, { status: 404 });
    if (String(refund.status).toLowerCase() !== 'failed') return NextResponse.json({ error: 'Can only retry failed refunds' }, { status: 400 });
    const business = await getActiveBusinessForUser(userId); if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    const retryAmount = Number(refund.refund_amount ?? refund.amount);
    const authorized = await requireTicket({ ticket: body.authorizationTicket, userId, businessId: business.id, action: 'refund', bind: { order_id: String(refund.order_id), amount: normalizeAmount(retryAmount) } });
    if (!authorized) return NextResponse.json({ error: 'PIN authorization required', code: 'PIN_REQUIRED' }, { status: 403 });
    await db.query('SELECT fb_reverse_failed_refund($1)', [refundId]);
    const result = await createAndSendRefund({ orderId: refund.order_id, ownerId: userId, amount: Number(refund.refund_amount ?? refund.amount), reason: refund.reason, notes: refund.notes });
    return NextResponse.json({ success: result.statusCode < 300, refundId: result.response.refundId, status: result.response.status, ...(result.response.error ? { error: result.response.error } : {}) }, { status: result.statusCode });
  } catch (error) {
    console.error('[v0] Refund retry failed:', error);
    return NextResponse.json({ error: 'Failed to retry refund' }, { status: 500 });
  }
}
