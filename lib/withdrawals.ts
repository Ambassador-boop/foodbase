import { db } from './db';

const PAYSTACK_API_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';

export const TERMINAL_FAILED_STATUSES = new Set(['failed', 'reversed', 'abandoned', 'blocked', 'rejected']);
const INCONCLUSIVE_STATUSES = new Set(['pending', 'otp', 'received', 'queued', 'processing']);
const ALLOWED_STATUSES = new Set(['pending', 'otp', 'received', 'queued', 'processing', 'success', 'failed', 'reversed', 'abandoned', 'blocked', 'rejected']);

function rowsOf(raw: any): any[] { return Array.isArray(raw) ? raw : raw?.rows ?? []; }

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
    if (newStatus === 'success') await db.query('SELECT fb_credit_withdrawal_fee($1) AS result', [withdrawalId]);
    return data;
  } catch (error) {
    console.error('[v0] verify transfer failed:', error);
    return null;
  }
}

export async function reconcileBusinessWithdrawals(businessId: string): Promise<{ scanned: number; reversed: number; reversedAmount: number }> {
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
  return { scanned: list.length, reversed, reversedAmount };
}

export { ALLOWED_STATUSES };
