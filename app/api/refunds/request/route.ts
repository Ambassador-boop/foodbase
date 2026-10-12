import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { createAndSendRefund } from '@/lib/refunds';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyJWT(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    const ownerId = (payload as any).userId || (payload as any).id;
    const body = await request.json();
    const { orderId, amount, reason, notes } = body || {};
    if (typeof orderId !== 'string' || !orderId.trim()) return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100) return NextResponse.json({ error: 'Amount must be a positive number with at most two decimal places' }, { status: 400 });
    if (typeof reason !== 'string' || !reason.trim() || reason.length > 200) return NextResponse.json({ error: 'Reason is required and must be 200 characters or fewer' }, { status: 400 });
    if (notes != null && (typeof notes !== 'string' || notes.length > 500)) return NextResponse.json({ error: 'Notes must be 500 characters or fewer' }, { status: 400 });
    const result = await createAndSendRefund({ orderId: orderId.trim(), ownerId, amount, reason: reason.trim(), notes });
    return NextResponse.json(result.response, { status: result.statusCode });
  } catch (error) {
    console.error('[v0] Refund request failed:', error);
    return NextResponse.json({ error: 'Failed to process refund' }, { status: 500 });
  }
}
