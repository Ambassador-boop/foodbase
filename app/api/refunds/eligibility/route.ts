import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyJWT(token);
    if (!user) return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 });
    const orderId = request.nextUrl.searchParams.get('orderId');
    if (!orderId) return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    const raw: any = await db.query(`SELECT o.service_fee_amount,t.amount,t.balance_bucket,b.available_balance,b.pending_balance,COALESCE((SELECT SUM(r.refund_amount) FROM refunds r WHERE r.order_id=o.id AND r.status NOT IN ('failed','rejected')),0) AS already_refunded FROM orders o JOIN businesses b ON b.id=o.business_id JOIN transactions t ON t.order_id=o.id WHERE o.id=$1 AND b.owner_id=$2 ORDER BY t.created_at ASC LIMIT 1`, [orderId, (user as any).userId || (user as any).id]);
    const row = (Array.isArray(raw) ? raw : raw?.rows ?? [])[0];
    if (!row) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    const netReceived = Number(row.amount || 0);
    const alreadyRefunded = Number(row.already_refunded || 0);
    const bucket = String(row.balance_bucket).toLowerCase() === 'pending' ? 'pending' : 'available';
    const bucketBalance = Number(bucket === 'pending' ? row.pending_balance : row.available_balance) || 0;
    return NextResponse.json({ netReceived, alreadyRefunded, refundable: Math.max(0, netReceived - alreadyRefunded), serviceFee: Number(row.service_fee_amount || 0), bucket, bucketBalance });
  } catch (error) {
    console.error('[v0] refund eligibility failed:', error);
    return NextResponse.json({ error: 'Failed to load refund eligibility' }, { status: 500 });
  }
}
