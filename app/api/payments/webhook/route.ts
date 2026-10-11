import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { settlePaystackPayment } from '@/lib/payments/settle';
import { sendOrderStatusNotification } from '@/lib/notification-service';

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
          try { await sendOrderStatusNotification(String(result.order_id), 'confirmed', 'paid'); } catch (error) {
            console.error('[v0] Webhook notification failed:', error);
          }
        }
        if (['settled', 'already_settled', 'amount_mismatch', 'order_not_found'].includes(result.status)) {
          return NextResponse.json({ success: true });
        }
        return NextResponse.json({ error: 'Settlement failed' }, { status: 500 });
      }
      case 'transfer.success':
      case 'transfer.failed':
      case 'transfer.reversed':
      case 'refund.processed':
      case 'refund.failed':
      case 'refund.pending':
      case 'refund.processing':
        return NextResponse.json({ success: true });
      default:
        return NextResponse.json({ success: true });
    }
  } catch (error) {
    console.error('[v0] Webhook processing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const reference = req.nextUrl.searchParams.get('reference');
    const trxref = req.nextUrl.searchParams.get('trxref');
    const paymentRef = reference || trxref;
    if (paymentRef) return NextResponse.redirect(new URL(`/payment-success?reference=${encodeURIComponent(paymentRef)}`, req.url));
    return NextResponse.json({ error: 'No reference provided' }, { status: 400 });
  } catch (error) {
    console.error('[v0] Webhook redirect error:', error);
    return NextResponse.json({ error: 'Failed to process redirect' }, { status: 500 });
  }
}
