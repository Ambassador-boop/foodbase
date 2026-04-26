import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

const PAYSTACK_API_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';

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

    return NextResponse.json({
      id: row.id,

      reference: row.payment_reference || null,
      transaction_id: row.transaction_id,
      paystack_refund_id: row.paystack_refund_id,

      amount: Number(row.refund_amount ?? row.legacy_amount ?? 0),
      original_amount: Number(row.original_amount ?? row.order_total ?? 0),
      currency: 'NGN',

      status: row.status,
      reason: row.reason,
      notes: row.notes,
      customer_note: row.customer_note,
      merchant_note: row.merchant_note,

      failure_reason: row.failure_reason,

      channel: row.channel,
      deducted_amount:
        row.deducted_amount != null ? Number(row.deducted_amount) : null,
      fully_deducted: row.fully_deducted,

      expected_at: row.expected_at,
      requested_at: row.requested_at,
      processed_at: row.processed_at,

      created_at: row.created_at,
      updated_at: row.updated_at,

      customer_name: row.customer_name,
      customer_email: row.customer_email,

      // 👇 ADD THIS (fix for your frontend crash)
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
  })
} catch (err) {
  console.error('[v0] GET /refunds/[id] error:', err);
  return NextResponse.json(
    { error: 'Failed to fetch refund' },
    { status: 500 },
  );
}
}
