import { db } from './db';
import { resolveTransferFee } from './paystack-fees';

const PAYSTACK_API_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';

export const TERMINAL_FAILED_STATUSES = new Set(['failed', 'reversed', 'abandoned', 'blocked', 'rejected']);
const INCONCLUSIVE_STATUSES = new Set(['pending', 'otp', 'received', 'queued', 'processing']);
const ALLOWED_STATUSES = new Set(['pending', 'otp', 'received', 'queued', 'processing', 'success', 'failed', 'reversed', 'abandoned', 'blocked', 'rejected']);

function rowsOf(raw: any): any[] { return Array.isArray(raw) ? raw : raw?.rows ?? []; }

/* -------------------------------------------------------------------------- */
/* Platform revenue: withdrawal fees and Paystack payout fees                  */
/* -------------------------------------------------------------------------- */

type LedgerResult = (Record<string, any> & { status?: string; fee?: number }) | null

function parseLedgerResult(raw: any): LedgerResult {
  const row = rowsOf(raw)[0]
  const result = row?.result
  if (result === null || result === undefined) return null
  if (typeof result === 'string') {
    try { return JSON.parse(result) } catch { return null }
  }
  return result
}

function feeErrorHint(error: unknown, functionName: string, column?: string): string {
  const code = (error as { code?: string })?.code ?? ''
  if (code === '42883') return `${functionName} is missing: run the 2e SQL for this batch`
  if (code === '42703') return `${column ?? 'a column'} is missing: add the column with the 2e SQL first`
  return 'the payout flow continues, but admin revenue will not include this fee'
}

/**
 * Credit the business withdrawal fee to admin revenue, exactly once.
 *
 * `withdrawals.withdrawal_fee` is charged to the business when the payout is
 * reserved; the platform keeps it. `fb_record_withdrawal_fee` (batch 2e) does the
 * write: only on a successful withdrawal, only once, guarded by `fee_credited`
 * and by the 'wfe_<id>' ledger marker inside one row lock.
 *
 * It prefers the 2e function this repository owns end to end and falls back to the
 * legacy `fb_credit_withdrawal_fee`, which stays untouched. Neither can break a
 * payout: every call is wrapped, so a database without the 2e SQL simply logs.
 */
export async function creditWithdrawalFee(id: string): Promise<LedgerResult> {
  try {
    const raw: any = await db.query('SELECT fb_record_withdrawal_fee($1) AS result', [id])
    const result = parseLedgerResult(raw)
    if (result?.status && result.status !== 'credited' && result.status !== 'already_credited') {
      console.warn(`[v0] Withdrawal fee not credited for ${id}: ${result.status}`)
    }
    if (result) return result
  } catch (error) {
    console.error(`[v0] Could not credit the withdrawal fee for ${id} (${feeErrorHint(error, 'fb_record_withdrawal_fee', 'withdrawals.fee_credited')}):`, error)
  }

  // Legacy fallback, unchanged. Wrapped so its behaviour can never throw into a
  // payout or a webhook, which is what let the fee go uncredited before.
  try {
    return parseLedgerResult(await db.query('SELECT fb_credit_withdrawal_fee($1) AS result', [id]))
  } catch (error) {
    console.error(`[v0] Legacy fb_credit_withdrawal_fee failed for ${id} (${feeErrorHint(error, 'fb_credit_withdrawal_fee')}):`, error)
    return null
  }
}

/**
 * Record what Paystack charged to send this withdrawal, exactly once.
 *
 * Paystack deducts its transfer fee (and, from N10,000 up, the N50 stamp duty)
 * from the account balance, but the transfer object carries no fee, so the figure
 * comes from the published tiers in lib/paystack-fees.ts. Only a successful
 * withdrawal is recorded; a failed or reversed payout records nothing. This is
 * admin-only data: it is never returned in a business-facing response.
 */
export async function recordWithdrawalProviderFee(id: string, data?: any): Promise<LedgerResult> {
  try {
    const raw: any = await db.query('SELECT amount::float8 AS amount, lower(status::text) AS status FROM withdrawals WHERE id=$1', [id])
    const row = rowsOf(raw)[0]
    if (!row) return null
    if (!['success', 'completed', 'processed'].includes(String(row.status))) return null

    const resolved = resolveTransferFee(Number(row.amount ?? 0), data)
    if (!(resolved.fee > 0)) return null

    const resultRaw: any = await db.query(
      'SELECT fb_admin_record_withdrawal_provider_fee($1,$2,$3) AS result',
      [id, resolved.fee, resolved.source],
    )
    const result = parseLedgerResult(resultRaw)
    if (result?.status && result.status !== 'recorded' && result.status !== 'already_recorded') {
      console.warn(`[v0] Payout fee not recorded for ${id}: ${result.status}`)
    }
    return result
  } catch (error) {
    console.error(`[v0] Could not record the Paystack fee for withdrawal ${id} (${feeErrorHint(error, 'fb_admin_record_withdrawal_provider_fee', 'withdrawals.provider_fee')}):`, error)
    return null
  }
}

/**
 * Everything that must happen when a withdrawal becomes successful.
 * Never throws, so a payout or webhook is never broken by revenue bookkeeping.
 */
export async function settleWithdrawalSuccess(id: string, data?: any): Promise<{ fee: LedgerResult; providerFee: LedgerResult }> {
  const fee = await creditWithdrawalFee(id)
  const providerFee = await recordWithdrawalProviderFee(id, data)
  return { fee, providerFee }
}

export async function reverseFailedWithdrawalIfNeeded(row: any): Promise<{ reversed: boolean; amount: number }> {
  const raw: any = await db.query('SELECT fb_reverse_failed_withdrawal($1) AS result', [row.id]);
  const result = rowsOf(raw)[0]?.result;
  const parsed = typeof result === 'string' ? JSON.parse(result) : result || {};
  return { reversed: parsed.status === 'reversed', amount: Number(parsed.amount ?? row.amount ?? 0) };
}

export async function verifyAndSyncTransfer(reference: string, withdrawalId: string): Promise<any | null> {
  if (!PAYSTACK_API_KEY || !reference) return null;
  try {
    const res = await fetch(`${PAYSTACK_BASE}/transfer/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${PAYSTACK_API_KEY}` } });
    if (res.status === 404) return { notFound: true };
    const json = await res.json();
    if (!res.ok || !json.status) return null;
    const data = json.data || {};
    const newStatus = String(data.status || '').toLowerCase();
    if (!ALLOWED_STATUSES.has(newStatus)) {
      console.warn('[v0] Ignoring unsupported transfer status');
      return data;
    }
    await db.query(`UPDATE withdrawals SET status=$1::withdrawal_status, gateway_response=$2, transfer_code=COALESCE($3,transfer_code), processed_at=CASE WHEN $1::text IN ('success','failed','reversed','abandoned','blocked','rejected') AND processed_at IS NULL THEN NOW() ELSE processed_at END, updated_at=NOW() WHERE id=$4`, [newStatus, data.gateway_response || data.failures || null, data.transfer_code || null, withdrawalId]);
    // Fee revenue and the provider's payout fee, exactly once, from every success path.
    if (newStatus === 'success') await settleWithdrawalSuccess(withdrawalId, data);
    return data;
  } catch (error) {
    console.error('[v0] verify transfer failed:', error);
    return null;
  }
}

export async function reconcileBusinessWithdrawals(businessId: string): Promise<{ scanned: number; reversed: number; reversedAmount: number; feesCredited: number }> {
  const raw: any = await db.query(`SELECT id,business_id,amount,withdrawal_fee,status,reference,payment_reference,balance_deducted,balance_reversed,created_at FROM withdrawals WHERE business_id=$1 AND (LOWER(status::text)=ANY($2) OR (LOWER(status::text)=ANY($3) AND balance_deducted=true AND balance_reversed=false))`, [businessId, Array.from(INCONCLUSIVE_STATUSES), Array.from(TERMINAL_FAILED_STATUSES)]);
  const list = rowsOf(raw);
  let reversed = 0, reversedAmount = 0;
  for (const row of list) {
    let current = row;
    if (INCONCLUSIVE_STATUSES.has(String(row.status).toLowerCase()) && row.reference) {
      const fresh = await verifyAndSyncTransfer(row.reference, row.id);
      if (fresh?.notFound && Date.now() - new Date(row.created_at).getTime() > 15 * 60 * 1000) {
        await db.query(`UPDATE withdrawals SET status='failed'::withdrawal_status, failure_reason=$1, updated_at=NOW() WHERE id=$2`, ['Transfer not found at provider', row.id]);
        current = { ...row, status: 'failed' };
      } else if (fresh) current = { ...row, status: fresh.status };
    }
    if (TERMINAL_FAILED_STATUSES.has(String(current.status).toLowerCase()) && current.balance_deducted && !current.balance_reversed) {
      const result = await reverseFailedWithdrawalIfNeeded(current);
      if (result.reversed) { reversed++; reversedAmount += result.amount; }
    }
  }
  // Self-heal: a payout that reached 'success' before its fee was ever credited
  // (the batch 2e audit found 54) is credited on the next reconcile pass, which
  // the cron and the withdrawals page both run. Guarded: a database without the
  // 2e SQL only logs, and rows already credited are never selected again.
  let feesCredited = 0;
  try {
    const uncreditedRaw: any = await db.query(
      `SELECT id FROM withdrawals
        WHERE business_id=$1
          AND LOWER(status::text) IN ('success','completed','processed')
          AND (COALESCE(fee_credited,false)=false OR COALESCE(provider_fee,0)=0)
        ORDER BY processed_at NULLS LAST, created_at
        LIMIT 50`,
      [businessId],
    );
    for (const row of rowsOf(uncreditedRaw)) {
      await settleWithdrawalSuccess(row.id);
      feesCredited++;
    }
  } catch (error) {
    console.error('[v0] Withdrawal fee self-heal skipped (run the batch 2e SQL to enable it):', error);
  }
  return { scanned: list.length, reversed, reversedAmount, feesCredited };
}

export { ALLOWED_STATUSES };
