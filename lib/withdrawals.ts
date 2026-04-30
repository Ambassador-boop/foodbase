/**
 * Shared withdrawal helpers — reused by:
 *   - /api/withdrawals/[withdrawalId]      (single)
 *   - /api/business/withdrawals            (list)
 *   - /api/cron/settle-balances            (nightly sweep)
 *
 * The reversal flow is idempotent via `withdrawals.balance_reversed`,
 * so it's safe to call from any number of code paths.
 */

import { db } from './db';
import { generateAlphanumericId } from './utils';

const PAYSTACK_API_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';

export const TERMINAL_FAILED_STATUSES = new Set([
  'failed',
  'reversed',
  'abandoned',
  'blocked',
  'rejected',
]);

const INCONCLUSIVE_STATUSES = new Set([
  'pending',
  'otp',
  'received',
  'queued',
]);

/* ------------------------------------------------------------------ */
/*  Verify a Paystack transfer and reconcile our DB row                */
/* ------------------------------------------------------------------ */

export async function verifyAndSyncTransfer(
  reference: string,
  withdrawalId: string,
): Promise<any | null> {
  if (!PAYSTACK_API_KEY || !reference) return null;
  try {
    const res = await fetch(
      `${PAYSTACK_BASE}/transfer/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_API_KEY}` } },
    );
    const json = await res.json();
    if (!res.ok || !json.status) return null;

    const data = json.data;
    const newStatus = data.status as string;

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

/* ------------------------------------------------------------------ */
/*  Restore funds for a failed withdrawal — idempotent                 */
/* ------------------------------------------------------------------ */

/**
 * If a withdrawal has hit a terminal failure status AND we haven't yet
 * reversed the balance, return the gross amount (amount + withdrawal_fee)
 * to the business's available_balance and write a `withdrawal_reversed`
 * finance_records row.
 *
 * Idempotency is guaranteed by the `balance_reversed` flag on
 * the withdrawals row — we set it inside the same transaction-ish
 * sequence that bumps the balance.
 */
export async function reverseFailedWithdrawalIfNeeded(row: any): Promise<{
  reversed: boolean;
  amount: number;
}> {
  const status = String(row.status || '').toLowerCase();
  if (!TERMINAL_FAILED_STATUSES.has(status))
    return { reversed: false, amount: 0 };
  if (row.balance_reversed === true) return { reversed: false, amount: 0 };

  const grossAmount =
    Number(row.amount || 0) + Number(row.withdrawal_fee || 0);
  if (grossAmount <= 0) return { reversed: false, amount: 0 };

  // Atomic flip-the-flag: only proceed if we successfully transition
  // balance_reversed from false to true. This protects against two
  // concurrent requests both crediting the balance.
  const flagRows: any = await db.query(
    `UPDATE withdrawals
        SET balance_reversed = true,
            updated_at = NOW()
      WHERE id = $1
        AND balance_reversed = false
      RETURNING id`,
    [row.id],
  );
  const flagList = Array.isArray(flagRows) ? flagRows : flagRows?.rows ?? [];
  if (flagList.length === 0) return { reversed: false, amount: 0 };

  try {
    await db.query(
      `UPDATE businesses
          SET available_balance = COALESCE(available_balance, 0) + $1,
              updated_at = NOW()
        WHERE id = $2`,
      [grossAmount, row.business_id],
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
        grossAmount,
        row.id,
        row.reference || row.payment_reference || null,
        `Withdrawal failed (${status}) — funds returned to available balance`,
      ],
    );

    console.log(
      '[v0] Withdrawal reversed:',
      row.id,
      'amount:',
      grossAmount,
    );
    return { reversed: true, amount: grossAmount };
  } catch (err) {
    // If the credit fails for any reason, undo the flag so the next
    // sweep can retry instead of stranding the funds.
    await db
      .query(
        `UPDATE withdrawals SET balance_reversed = false WHERE id = $1`,
        [row.id],
      )
      .catch(() => {});
    console.error('[v0] Withdrawal reversal credit failed:', err);
    return { reversed: false, amount: 0 };
  }
}

/* ------------------------------------------------------------------ */
/*  Sweep — reconcile every pending/inconclusive withdrawal for a biz  */
/* ------------------------------------------------------------------ */

/**
 * Walk every withdrawal that is either inconclusive (pending/otp/etc.)
 * OR already in a terminal failed state but not yet reversed, refresh
 * its Paystack status, and credit the available balance back when
 * appropriate.
 *
 * Called from the withdrawals list endpoint and from the nightly cron
 * so the business owner doesn't have to click into the detail page for
 * the reversal to happen.
 */
export async function reconcileBusinessWithdrawals(
  businessId: string,
): Promise<{ scanned: number; reversed: number; reversedAmount: number }> {
  const rows: any = await db.query(
    `SELECT id, business_id, amount, withdrawal_fee, status, reference,
            payment_reference, balance_reversed
       FROM withdrawals
      WHERE business_id = $1
        AND (
              (LOWER(status::text) = ANY ($2))
           OR (LOWER(status::text) = ANY ($3) AND balance_reversed = false)
        )`,
    [
      businessId,
      Array.from(INCONCLUSIVE_STATUSES),
      Array.from(TERMINAL_FAILED_STATUSES),
    ],
  );
  const list: any[] = Array.isArray(rows) ? rows : rows?.rows ?? [];

  let reversedCount = 0;
  let reversedAmount = 0;

  for (const w of list) {
    let current = w;
    if (
      current.reference &&
      INCONCLUSIVE_STATUSES.has(String(current.status).toLowerCase())
    ) {
      const fresh = await verifyAndSyncTransfer(current.reference, current.id);
      if (fresh) {
        current = { ...current, status: fresh.status };
      }
    }

    const result = await reverseFailedWithdrawalIfNeeded(current);
    if (result.reversed) {
      reversedCount += 1;
      reversedAmount += result.amount;
    }
  }

  return {
    scanned: list.length,
    reversed: reversedCount,
    reversedAmount,
  };
}
