import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

const PAYSTACK_API_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';

/* ------------------------------------------------------------------ */
/*  GET — full transaction details + Paystack verification             */
/* ------------------------------------------------------------------ */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const token =
      request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    const userId = (payload as any).userId || (payload as any).id;
    const { orderId } = await params;

    /* -------- Order + ownership check --------------------------- */
    const orderRows: any = await db.query(
      `SELECT
         o.id, o.business_id, o.customer_name, o.customer_email,
         o.customer_phone, o.address, o.notes, o.status,
         o.payment_status, o.payment_reference, o.total_amount,
         o.service_fee_amount, o.created_at, o.paid_at, o.completed_at,
         b.name AS business_name, b.logo_url
       FROM orders o
       JOIN businesses b ON o.business_id = b.id
       WHERE o.id = $1 AND b.owner_id = $2`,
      [orderId, userId],
    );
    const orderList = Array.isArray(orderRows) ? orderRows : orderRows?.rows ?? [];
    if (orderList.length === 0) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }
    const order = orderList[0];

    /* -------- Order items --------------------------------------- */
    const itemRows: any = await db.query(
      `SELECT
         oi.id, oi.menu_item_id, oi.quantity, oi.item_price, oi.configuration,
         mi.name AS menu_item_name, mi.image_url AS menu_item_image
       FROM order_items oi
       LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
       WHERE oi.order_id = $1
       ORDER BY oi.created_at ASC`,
      [orderId],
    );
    const items = (Array.isArray(itemRows) ? itemRows : itemRows?.rows ?? []).map(
      (it: any) => ({
        id: it.id,
        menu_item_id: it.menu_item_id,
        name: it.menu_item_name,
        image: it.menu_item_image,
        quantity: it.quantity,
        item_price: Number(it.item_price ?? 0),
        configuration: it.configuration,
      }),
    );

    /* -------- Refunds for this order ---------------------------- */
    const refundRows: any = await db.query(
      `SELECT id, amount, refund_amount, status, created_at, reason
         FROM refunds
        WHERE order_id = $1
        ORDER BY created_at DESC`,
      [orderId],
    );
    const refunds = (Array.isArray(refundRows) ? refundRows : refundRows?.rows ?? []).map(
      (r: any) => ({
        id: r.id,
        amount: Number(r.refund_amount ?? r.amount ?? 0),
        status: r.status,
        reason: r.reason,
        created_at: r.created_at,
      }),
    );

    /* -------- Paystack verification ----------------------------- */
    let paystack: any = null;
    if (PAYSTACK_API_KEY && order.payment_reference) {
      try {
        const res = await fetch(
          `${PAYSTACK_BASE}/transaction/verify/${encodeURIComponent(
            order.payment_reference,
          )}`,
          { headers: { Authorization: `Bearer ${PAYSTACK_API_KEY}` } },
        );
        const json = await res.json();
        if (res.ok && json.status) {
          paystack = json.data;
        } else {
          paystack = { error: json.message || 'Verification failed' };
        }
      } catch (err) {
        console.error('[v0] Paystack verify error:', err);
      }
    }

    return NextResponse.json({
      order: {
        ...order,
        total_amount: Number(order.total_amount ?? 0),
        service_fee_amount: Number(order.service_fee_amount ?? 0),
      },
      items,
      refunds,
      paystack,
    });
  } catch (err) {
    console.error('[v0] GET /business/transactions/[orderId] error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch transaction' },
      { status: 500 },
    );
  }
}
