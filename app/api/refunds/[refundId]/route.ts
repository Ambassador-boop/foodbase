import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { generateAlphanumericId } from '@/lib/utils';

const PAYSTACK_API_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';

const TERMINAL_FAILED = new Set(['failed', 'rejected']);

async function syncRefundFromPaystack(paystackRefundId: string, refundId: string) {
  if (!PAYSTACK_API_KEY || !paystackRefundId) return null;
  try {
    const res = await fetch(
      `${PAYSTACK_BASE}/refund/${encodeURIComponent(paystackRefundId)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_API_KEY}` } },
    );
    const json = await res.json();
    if (!res.ok || !json.status) return null;
    const data = json.data;
    await db.query(
      `UPDATE refunds
          SET status = $1::text,
              channel = COALESCE($2, channel),
              deducted_amount = COALESCE($3, deducted_amount),
              fully_deducted = COALESCE($4, fully_deducted),
              expected_at = COALESCE($5, expected_at),
              processed_at = CASE
                WHEN $1::text IN ('processed','failed') AND processed_at IS NULL
                THEN NOW() ELSE processed_at END,
              updated_at = NOW()
        WHERE id = $6`,
      [
        data.status,
        data.channel || null,
        data.deducted_amount != null ? Number(data.deducted_amount) / 100 : null,
        data.fully_deducted ?? null,
        data.expected_at || null,
        refundId,
      ],
    );
    return data;
  } catch (err) {
    console.error('[v0] sync refund error:', err);
    return null;
  }
}

/**
 * If a refund has hit a terminal failure status AND we previously debited
 * the business's balance for it, restore the funds to the same bucket
 * that was originally affected. Idempotent — once processed, refunds.amount
 * is left alone but a per-record marker is set via failure_reason updates.
 *
 * To keep the operation idempotent we use a small guard table keyed by
 * refund id; that way repeated GETs after the failure don't keep crediting.
 */
async function ensureFailedRefundReversed(refundId: string) {
  // Check current refund row + see if we've already reversed
  const r: any = await db.query(
    `SELECT r.id, r.status, r.refund_amount, r.amount,
            r.balance_affected, r.business_id,
            EXISTS (
              SELECT 1 FROM finance_records fr
               WHERE fr.related_id = r.id
                 AND fr.record_type = 'refund_reversed'
            ) AS already_reversed
       FROM refunds r
      WHERE r.id = $1`,
    [refundId],
  );
  const row = (Array.isArray(r) ? r : r?.rows ?? [])[0];
  if (!row) return;

  const status = String(row.status || '').toLowerCase();
  if (!TERMINAL_FAILED.has(status)) return;
  if (row.already_reversed) return;

  const amount = Number(row.refund_amount ?? row.amount ?? 0) || 0;
  if (amount <= 0) return;

  // balance_affected may be NULL on legacy rows — default to 'available'
  const bucket =
    String(row.balance_affected || 'available').toLowerCase() === 'pending'
      ? 'pending'
      : 'available';

  try {
    if (bucket === 'pending') {
      await db.query(
        `UPDATE businesses
            SET pending_balance = COALESCE(pending_balance, 0) + $1,
                updated_at = NOW()
          WHERE id = $2`,
        [amount, row.business_id],
      );
    } else {
      await db.query(
        `UPDATE businesses
            SET available_balance = COALESCE(available_balance, 0) + $1,
                updated_at = NOW()
          WHERE id = $2`,
        [amount, row.business_id],
      );
    }

    await db.query(
      `INSERT INTO finance_records
         (id, business_id, record_type, bucket, direction, amount,
          related_id, reference, description, created_at)
       VALUES ($1, $2, 'refund_reversed', $3, 'in', $4, $5, NULL,
               'Refund failed at gateway — funds restored', NOW())`,
      [
        `fr_${generateAlphanumericId()}`,
        row.business_id,
        bucket,
        amount,
        row.id,
      ],
    );

    console.log('[v0] Refund reversed on failed sync:', refundId);
  } catch (err) {
    console.error('[v0] Refund reversal failed:', err);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ refundId: string }> },
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
    const { refundId } = await params;

    const result: any = await db.query(
      `SELECT
         r.id, r.order_id, r.transaction_id, r.business_id,
         r.original_amount, r.refund_amount, r.amount AS legacy_amount,
         r.status, r.reason, r.notes,
         r.customer_note, r.merchant_note,
         r.paystack_refund_id, r.failure_reason,
         r.channel, r.deducted_amount, r.fully_deducted,
         r.balance_affected,
         r.expected_at, r.requested_at, r.processed_at,
         r.created_at, r.updated_at,
         o.customer_name, o.customer_email, o.payment_reference,
         o.total_amount AS order_total
       FROM refunds r
       JOIN orders o ON r.order_id = o.id
       JOIN businesses b ON o.business_id = b.id
       WHERE r.id = $1 AND b.owner_id = $2`,
      [refundId, userId],
    );
    const list = Array.isArray(result) ? result : result?.rows ?? [];
    if (list.length === 0) {
      return NextResponse.json({ error: 'Refund not found' }, { status: 404 });
    }
    let row = list[0];

    // Sync from Paystack if not yet conclusive
    if (
      row.paystack_refund_id &&
      ['pending', 'processing', 'needs-attention'].includes(
        String(row.status).toLowerCase(),
      )
    ) {
      const fresh = await syncRefundFromPaystack(row.paystack_refund_id, refundId);
      if (fresh) {
        row = {
          ...row,
          status: fresh.status,
          channel: fresh.channel || row.channel,
          deducted_amount:
            fresh.deducted_amount != null
              ? Number(fresh.deducted_amount) / 100
              : row.deducted_amount,
          expected_at: fresh.expected_at || row.expected_at,
        };
      }
    }

    // If sync flipped this into a terminal failure, restore funds.
    await ensureFailedRefundReversed(refundId);

    return NextResponse.json({
      id: row.id,

      reference: row.payment_reference || null,
      amount: Number(row.refund_amount ?? row.legacy_amount ?? 0),
      original_amount: Number(row.original_amount ?? row.order_total ?? 0),
      currency: 'NGN',

      status: row.status,
      reason: row.reason,
      notes: row.notes,
      customer_note: row.customer_note,
      merchant_note: row.merchant_note,
      balance_affected: row.balance_affected,

      failure_reason: row.failure_reason,

      expected_at: row.expected_at,
      requested_at: row.requested_at,
      processed_at: row.processed_at,

      created_at: row.created_at,
      updated_at: row.updated_at,

      customer_name: row.customer_name,
      customer_email: row.customer_email,

      order: {
        id: row.order_id,
        customer_name: row.customer_name,
        customer_email: row.customer_email,
        customer_phone: null,
        total_amount: Number(row.order_total ?? 0),
        payment_reference: row.payment_reference,
        created_at: row.created_at,
      },

      business: {
        id: row.business_id,
        name: '',
        slug: null,
        logo_url: null,
      },
    });
  } catch (err) {
    console.error('[v0] GET /refunds/[id] error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch refund' },
      { status: 500 },
    );
  }
}
