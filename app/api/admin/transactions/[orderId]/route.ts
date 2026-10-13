import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';

function rowsOf(raw: any): any[] { return Array.isArray(raw) ? raw : raw?.rows ?? []; }
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const token = await getTokenFromRequest(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await verifyToken(token);
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { orderId } = await params;
    const orderRaw = await db.query(`SELECT o.*,b.name AS business_name FROM orders o LEFT JOIN businesses b ON b.id=o.business_id WHERE o.id=$1`, [orderId]);
    const order = rowsOf(orderRaw)[0];
    if (!order) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    const txRaw = await db.query('SELECT * FROM transactions WHERE order_id=$1 ORDER BY created_at ASC', [orderId]);
    let paystack = null;
    if (PAYSTACK_SECRET_KEY && order.payment_reference) {
      const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(order.payment_reference)}`, { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } });
      const json = await response.json().catch(() => ({}));
      paystack = response.ok ? json.data ?? null : { error: json.message || 'Verification failed' };
    }
    return NextResponse.json({ order, transactions: rowsOf(txRaw), paystack });
  } catch (error) {
    console.error('[v0] admin transaction route failed');
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 });
  }
}
