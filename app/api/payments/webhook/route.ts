import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { settlePaystackPayment } from '@/lib/payments/settle';
import { sendOrderStatusNotification } from '@/lib/notification-service';

function rowsOf(raw: any): any[] { return Array.isArray(raw) ? raw : raw?.rows ?? []; }

export async function POST(req: NextRequest) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: 'Webhook is not configured' }, { status: 500 });
  try {
    const body = await req.text();
    const signature = req.headers.get('x-paystack-signature') ?? '';
    const expected = crypto.createHmac('sha512', secret).update(body).digest();
    const received = Buffer.from(signature, 'hex');
    if (received.length !== expected.length || !crypto.timingSafeEqual(expected, received)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
    const event = JSON.parse(body);
    switch (event.event) {
      case 'charge.success': {
        const result = await settlePaystackPayment(event.data);
        if (result.status === 'settled') {
          try { await sendOrderStatusNotification(String(result.order_id), 'confirmed', 'paid'); } catch (error) { console.error('[v0] Webhook notification failed:', error); }
        }
        return NextResponse.json({ success: true });
      }
      case 'transfer.success':
      case 'transfer.failed':
      case 'transfer.reversed': {
        const status = event.event === 'transfer.success' ? 'success' : event.event.slice('transfer.'.length);
        const reference = event.data?.reference ?? event.data?.transfer_code;
        const foundRaw: any = await db.query('SELECT id FROM withdrawals WHERE reference=$1 OR transfer_code=$1 LIMIT 1', [String(reference ?? '')]);
        const withdrawal = rowsOf(foundRaw)[0];
        if (withdrawal) {
          await db.query(`UPDATE withdrawals SET status=$1::withdrawal_status, processed_at=CASE WHEN $1 IN ('success','failed','reversed') THEN COALESCE(processed_at,NOW()) ELSE processed_at END, gateway_response=COALESCE($2,gateway_response), updated_at=NOW() WHERE id=$3`, [status, event.data?.reason ?? null, withdrawal.id]);
          if (status === 'success') await db.query('SELECT fb_credit_withdrawal_fee($1) AS result', [withdrawal.id]);
          else await db.query('SELECT fb_reverse_failed_withdrawal($1) AS result', [withdrawal.id]);
        }
        return NextResponse.json({ success: true });
      }
      case 'refund.processed':
      case 'refund.failed':
      case 'refund.pending':
      case 'refund.processing': {
        const status = event.event === 'refund.processed' ? 'processed' : event.event === 'refund.failed' ? 'failed' : 'pending';
        const raw: any = await db.query('SELECT id FROM refunds WHERE paystack_refund_id=$1', [String(event.data?.id ?? '')]);
        const refund = rowsOf(raw)[0];
        if (refund) {
          await db.query(`UPDATE refunds SET status=$1, processed_at=CASE WHEN $1 IN ('processed','failed') THEN COALESCE(processed_at,NOW()) ELSE processed_at END, updated_at=NOW() WHERE id=$2`, [status, refund.id]);
          if (status === 'failed') await db.query('SELECT fb_reverse_failed_refund($1) AS result', [refund.id]);
        }
        return NextResponse.json({ success: true });
      }
      default: return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('[v0] Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get('reference') || req.nextUrl.searchParams.get('trxref');
  if (reference) return NextResponse.redirect(new URL(`/payment-success?reference=${encodeURIComponent(reference)}`, req.url));
  return NextResponse.json({ error: 'No reference provided' }, { status: 400 });
}

export { rowsOf };
