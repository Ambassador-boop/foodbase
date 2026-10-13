import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

function rowsOf(raw: any): any[] { return Array.isArray(raw) ? raw : raw?.rows ?? []; }
function maskEmail(email: string | null) {
  if (!email) return null;
  const [local, domain] = email.split('@');
  return local && domain ? `${local[0]}•••@${domain}` : null;
}
function paymentStatus(status: unknown) {
  const value = String(status || '').toLowerCase();
  if (['success', 'paid', 'completed'].includes(value)) return 'success';
  if (['failed', 'failure'].includes(value)) return 'failed';
  if (['abandoned', 'reversed'].includes(value)) return value;
  return 'pending';
}
function methodLabel(method: unknown) {
  const value = String(method || '').toLowerCase();
  if (value.includes('card')) return 'Card';
  if (value.includes('bank')) return 'Bank transfer';
  if (value.includes('ussd')) return 'USSD';
  return 'Online payment';
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value;
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const payload = await verifyJWT(token);
    if (!payload) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    const userId = (payload as any).userId || (payload as any).id;
    const { orderId } = await params;
    const orderRaw = await db.query(`SELECT o.id,o.business_id,o.customer_name,o.customer_email,o.customer_phone,o.address,o.notes,o.status,o.payment_status,o.payment_reference,o.total_amount,o.service_fee_amount,o.created_at,o.paid_at,o.completed_at,b.name AS business_name FROM orders o JOIN businesses b ON b.id=o.business_id WHERE o.id=$1 AND b.owner_id=$2`, [orderId, userId]);
    const order = rowsOf(orderRaw)[0];
    if (!order) return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    const itemRaw = await db.query(`SELECT oi.id,oi.menu_item_id,oi.quantity,oi.item_price,oi.configuration,mi.name AS menu_item_name,mi.image_url AS menu_item_image FROM order_items oi LEFT JOIN menu_items mi ON mi.id=oi.menu_item_id WHERE oi.order_id=$1 ORDER BY oi.created_at ASC`, [orderId]);
    const items = rowsOf(itemRaw).map((it: any) => ({ id: it.id, menu_item_id: it.menu_item_id, name: it.menu_item_name, image: it.menu_item_image, quantity: it.quantity, item_price: Number(it.item_price || 0), configuration: it.configuration }));
    const refundRaw = await db.query(`SELECT id,refund_amount,amount,status,reason,created_at FROM refunds WHERE order_id=$1 ORDER BY created_at DESC`, [orderId]);
    const refunds = rowsOf(refundRaw).map((r: any) => ({ id: r.id, amount: Number(r.refund_amount ?? r.amount ?? 0), status: r.status, reason: r.reason, created_at: r.created_at }));
    const txRaw = await db.query(`SELECT amount,payment_method,channel,balance_bucket,settlement_status,available_at,settled_at FROM transactions WHERE order_id=$1 ORDER BY created_at ASC LIMIT 1`, [orderId]);
    const tx = rowsOf(txRaw)[0] || null;
    return NextResponse.json({
      order: { id: order.id, customer_name: order.customer_name, customer_email_masked: maskEmail(order.customer_email), customer_phone: order.customer_phone, address: order.address, notes: order.notes, status: order.status, payment_status: order.payment_status, payment_reference: order.payment_reference, total_amount: Number(order.total_amount || 0), service_fee_amount: Number(order.service_fee_amount || 0), created_at: order.created_at, paid_at: order.paid_at, completed_at: order.completed_at, business_name: order.business_name },
      items,
      refunds,
      payment: { status: paymentStatus(order.payment_status), method_label: methodLabel(tx?.payment_method || tx?.channel), paid_at: order.paid_at },
      settlement: { net_received: tx ? Number(tx.amount || 0) : null, balance_bucket: tx?.balance_bucket ?? null, settlement_status: tx?.settlement_status ?? null, available_at: tx?.available_at ?? null, settled_at: tx?.settled_at ?? null },
    });
  } catch (error) {
    console.error('[v0] business transaction privacy route failed');
    return NextResponse.json({ error: 'Failed to fetch transaction' }, { status: 500 });
  }
}
