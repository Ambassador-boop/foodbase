import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { generateAlphanumericId } from '@/lib/utils';

const PAYSTACK_API_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';

const TERMINAL_FAILED = new Set([
  'failed',
  'reversed',
  'abandoned',
  'blocked',
  'rejected',
]);

/* ------------------------------------------------------------------ */
/*  Verify the live Paystack status and reconcile our DB row           */
/* ------------------------------------------------------------------ */

async function verifyAndSyncTransfer(reference: string, withdrawalId: string) {
  if (!PAYSTACK_API_KEY || !reference) return null;
  try {
    const res = await fetch(
      `${PAYSTACK_BASE}/transfer/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${PAYSTACK_API_KEY}` },
      },
    );
    const json = await res.json();
    if (!res.ok || !json.status) return null;

    const data = json.data;
    const newStatus = data.status as string; // pending|success|failed|reversed|otp|abandoned|blocked|rejected|received

    await db.query(
      `UPDATE withdrawals
              SET status = $1::withdrawal_status,
                        gateway_response = $2,
                                  transfer_code = COALESCE($3, transfer_code),
                                            processed_at = CASE
                                                        WHEN $1::text IN ('success','failed','reversed','abandoned','blocked','rejected')
                                                                      AND processed_at IS NULL
                                                                                  THEN NOW()
                                                                                              ELSE processed_at
                                                                                                        END,
                                                                                                                  updated_at = NOW()
                                                                                                                      WHERE id = $4::text`,
      [
        newStatus,
        data.gateway_response || data.failures || null,
        data.transfer_code || null,
        withdrawalId,
      ],
    );

    return data;
  } catch (err) {
    console.error('[v0] verifyAndSyncTransfer error:', err);
    return null;
  }
}

/**
 * If a withdrawal has hit a terminal failure status AND we haven't yet
 * reversed the balance, return the gross amount to the business's
 * available_balance and write a 'withdrawal_reversed' finance_records row.
 *
 * Idempotent via the `balance_reversed` flag on withdrawals.
 */
async function reverseFailedWithdrawalIfNeeded(row: any) {
  const status = String(row.status || '').toLowerCase();
  if (!TERMINAL_FAILED.has(status)) return;
  if (row.balance_reversed === true) return;

  const amount = Number(row.amount) || 0;
  if (amount <= 0) return;

  try {
    await db.query(
      `UPDATE businesses
          SET available_balance = COALESCE(available_balance, 0) + $1,
              updated_at = NOW()
        WHERE id = $2`,
      [amount, row.business_id],
    );

    await db.query(
      `UPDATE withdrawals
          SET balance_reversed = true,
              updated_at = NOW()
        WHERE id = $1`,
      [row.id],
    );

    await db.query(
      `INSERT INTO finance_records
         (id, business_id, record_type, bucket, direction, amount,
          related_id, reference, description, created_at)
       VALUES ($1, $2, 'withdrawal_reversed', 'available', 'in', $3, $4, $5,
               $6, NOW())`,
      [
        `fr_${generateAlphanumericId()}`,
        row.business_id,
        amount,
        row.id,
        row.reference || row.payment_reference || null,
        `Withdrawal failed (${status}) — funds returned to available balance`,
      ],
    );

    console.log('[v0] Withdrawal reversed:', row.id, 'amount:', amount);
  } catch (err) {
    console.error('[v0] Withdrawal reversal failed:', err);
  }
}

/* ------------------------------------------------------------------ */
/*  GET — single withdrawal with timeline data                         */
/* ------------------------------------------------------------------ */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ withdrawalId: string }> },
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
    const { withdrawalId } = await params;

    const result: any = await db.query(
      `SELECT
         w.*,
         b.name AS business_name
       FROM withdrawals w
       JOIN businesses b ON w.business_id = b.id
       WHERE w.id = $1 AND b.owner_id = $2`,
      [withdrawalId, userId],
    );
    const list = Array.isArray(result) ? result : result?.rows ?? [];
    if (list.length === 0) {
      return NextResponse.json(
        { error: 'Withdrawal not found' },
        { status: 404 },
      );
    }
    let row = list[0];

    // If the withdrawal is not yet conclusive, hit Paystack to refresh it
    const inconclusive = ['pending', 'otp', 'received', 'queued'];
    if (
      row.reference &&
      inconclusive.includes(String(row.status).toLowerCase())
    ) {
      const fresh = await verifyAndSyncTransfer(row.reference, row.id);
      if (fresh) {
        row = {
          ...row,
          status: fresh.status,
          gateway_response: fresh.gateway_response || row.gateway_response,
          transfer_code: fresh.transfer_code || row.transfer_code,
        };
      }
    }

    // After possibly refreshing, if it's now in a failed state and we
    // haven't already restored the funds, do it now.
    await reverseFailedWithdrawalIfNeeded(row);

    return NextResponse.json({
      id: row.id,
      amount: Number(row.amount ?? 0),
      net_amount: row.net_amount != null ? Number(row.net_amount) : null,
      withdrawal_fee:
        row.withdrawal_fee != null ? Number(row.withdrawal_fee) : 0,
      service_fee: row.service_fee != null ? Number(row.service_fee) : 0,
      status: row.status,
      bank_code: row.bank_code,
      bank_account_number: row.bank_account_number,
      bank_account_holder: row.bank_account_holder,
      reference: row.reference || row.payment_reference,
      payment_reference: row.payment_reference,
      transfer_code: row.transfer_code,
      paystack_transfer_id: row.paystack_transfer_id,
      gateway_response: row.gateway_response,
      failure_reason: row.failure_reason,
      notes: row.notes,
      requested_at: row.requested_at,
      processed_at: row.processed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      business_name: row.business_name,
      balance_reversed: !!row.balance_reversed,
    });
  } catch (err) {
    console.error('[v0] GET /withdrawals/[id] error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch withdrawal' },
      { status: 500 },
    );
  }
}
