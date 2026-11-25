import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { settleWithdrawalSuccess } from '@/lib/withdrawals';
import { recordAdminTransferFee } from '@/lib/admin-transfers';
import { settlePaystackPayment, type PaystackPaymentData } from '@/lib/payments/settle';
import { sendOrderStatusNotification } from '@/lib/notification-service';
import { notifyRestaurantPaidOrder } from '@/lib/paid-order-notification';
import { env } from '@/lib/env';
import { z } from 'zod';
import { fail } from '@/lib/api';
import { handleUnexpected } from '@/lib/api/handler';

function rowsOf(raw: any): any[] { return Array.isArray(raw) ? raw : raw?.rows ?? []; }

/**
 * The event envelope only.
 *
 * The contents of `data` differ per event and are read field by field in the
 * switch below, exactly as before. This schema exists so a signed but
 * structurally broken payload is refused once, before anything touches the
 * database. The signature check above is untouched.
 */
const WebhookEnvelope = z.object({
  event: z.string().min(1),
  data: z.record(z.unknown()),
});

export async function POST(req: NextRequest) {
  const secret = env.PAYSTACK_SECRET_KEY;
  if (!secret) return fail('WEBHOOK_NOT_CONFIGURED', 'Webhook is not configured', 500);
  try {
    const body = await req.text();
    const signature = req.headers.get('x-paystack-signature') ?? '';
    const expected = crypto.createHmac('sha512', secret).update(body).digest();
    const received = Buffer.from(signature, 'hex');
    if (received.length !== expected.length || !crypto.timingSafeEqual(expected, received)) {
      return fail('INVALID_SIGNATURE', 'Invalid signature', 401);
    }
    const parsedEvent = WebhookEnvelope.safeParse(JSON.parse(body));
    if (!parsedEvent.success) return fail('INVALID_EVENT', 'Malformed event payload', 400);
    const event = parsedEvent.data;
    switch (event.event) {
      case 'charge.success': {
        // `charge.success` carries a payment object; the envelope check above
        // only guarantees it is an object, so the payment shape is asserted here
        // and validated field by field inside fb_settle_payment.
        const result = await settlePaystackPayment(event.data as PaystackPaymentData);
        if (result.status === 'settled') {
          try { await sendOrderStatusNotification(String(result.order_id), 'confirmed', 'paid'); } catch (error) { console.error('[v0] Webhook notification failed:', error); }
        }
        // Batch 3C: one paid-order alert per order, whichever of verify and this
        // webhook gets there first. The claim inside the function decides.
        if ((result.status === 'settled' || result.status === 'already_settled') && result.order_id) {
          try { await notifyRestaurantPaidOrder(String(result.order_id)); } catch (error) { console.error('[v0] Paid order notification failed:', error); }
        }
        return NextResponse.json({ success: true });
      }
      case 'transfer.success':
      case 'transfer.failed':
      case 'transfer.reversed': {
        const status = event.event === 'transfer.success' ? 'success' : event.event.slice('transfer.'.length);
        const reference = event.data?.reference;
        const transferCode = event.data?.transfer_code;
        const foundRaw: any = await db.query('SELECT id FROM withdrawals WHERE reference=$1 OR transfer_code=$2 LIMIT 1', [String(reference ?? ''), String(transferCode ?? '')]);
        const withdrawal = rowsOf(foundRaw)[0];
        if (withdrawal) {
          await db.query(`UPDATE withdrawals SET status=$1::withdrawal_status, processed_at=CASE WHEN $1 IN ('success','failed','reversed') THEN COALESCE(processed_at,NOW()) ELSE processed_at END, gateway_response=COALESCE($2,gateway_response), updated_at=NOW() WHERE id=$3`, [status, event.data?.reason ?? null, withdrawal.id]);
          // Fee revenue + the provider's payout fee, exactly once, whichever path got here first.
          if (status === 'success') await settleWithdrawalSuccess(withdrawal.id, event.data);
          else await db.query('SELECT fb_reverse_failed_withdrawal($1) AS result', [withdrawal.id]);
        } else {
          const adminRaw: any = await db.query('SELECT id FROM admin_transfers WHERE reference=$1 OR paystack_transfer_code=$2 LIMIT 1', [String(reference ?? ''), String(transferCode ?? '')]);
          const admin = rowsOf(adminRaw)[0];
          if (admin) {
            await db.query(`UPDATE admin_transfers SET status=$1, processed_at=CASE WHEN $1='success' THEN COALESCE(processed_at,NOW()) ELSE processed_at END, paystack_transfer_code=COALESCE($2,paystack_transfer_code), updated_at=NOW() WHERE id=$3`, [status, transferCode ?? null, admin.id]);
            if (status === 'failed' || status === 'reversed') await db.query('SELECT fb_admin_reverse_transfer($1) AS result', [admin.id]);
            // Same recorder the reconcile path uses. Idempotent, never throws.
            if (status === 'success') await recordAdminTransferFee(admin.id, event.data);
          }
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
    return handleUnexpected(error, { where: 'POST /api/payments/webhook', request: req });
  }
}

export async function GET(req: NextRequest) {
  const reference = req.nextUrl.searchParams.get('reference') || req.nextUrl.searchParams.get('trxref');
  if (reference) return NextResponse.redirect(new URL(`/payment-success?reference=${encodeURIComponent(reference)}`, req.url));
  return fail('REFERENCE_REQUIRED', 'No reference provided', 400);
}

