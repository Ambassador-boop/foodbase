import { db } from '@/lib/db';
import { nanoid } from 'nanoid';

const PAYSTACK_BASE = 'https://api.paystack.co';
const PAYSTACK_API_KEY = process.env.PAYSTACK_SECRET_KEY;
export class ProviderRejected extends Error {}
export class ProviderUnreachable extends Error {}
function rowsOf(raw: any): any[] { return Array.isArray(raw) ? raw : raw?.rows ?? []; }
export function normalizeProviderStatus(status: unknown): string { return String(status || 'pending').toLowerCase(); }
export async function providerJson(path: string, init: RequestInit): Promise<any> {
  let response: Response;
  try { response = await fetch(`${PAYSTACK_BASE}${path}`, { ...init, signal: init.signal ?? AbortSignal.timeout(15000) }); }
  catch { throw new ProviderUnreachable('Payment provider unavailable'); }
  let body: any = {}; try { body = await response.json(); } catch {}
  if (response.status >= 500) throw new ProviderUnreachable('Payment provider unavailable');
  if (!response.ok || body?.status !== true) throw new ProviderRejected(body?.message || 'Payment provider rejected the request');
  return body.data;
}
export async function createAdminRecipient(accountNumber: string, bankCode: string, name: string) {
  return providerJson('/transferrecipient', { method: 'POST', headers: { Authorization: `Bearer ${PAYSTACK_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'nuban', name, account_number: accountNumber, bank_code: bankCode, currency: 'NGN' }) });
}
export async function initiateAdminTransfer(recipient: string, amount: number, reference: string, reason: string) {
  return providerJson('/transfer', { method: 'POST', headers: { Authorization: `Bearer ${PAYSTACK_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'balance', amount: Math.round(amount * 100), recipient, reference, reason }) });
}
export async function verifyAdminTransfer(reference: string) {
  try { return { data: await providerJson(`/transfer/verify/${encodeURIComponent(reference)}`, { method: 'GET', headers: { Authorization: `Bearer ${PAYSTACK_API_KEY}` } }) }; }
  catch (error) { if (error instanceof ProviderRejected && /not found|does not exist/i.test(error.message)) return { notFound: true }; throw error; }
}
export async function reverseAdminTransfer(id: string, reason: string) {
  await db.query('UPDATE admin_transfers SET status=$1, failure_reason=$2, updated_at=NOW() WHERE id=$3', ['failed', reason, id]);
  await db.query('SELECT fb_admin_reverse_transfer($1) AS result', [id]);
}
export async function reconcileAdminTransfers(kind: string) {
  const raw: any = await db.query('SELECT id, reference FROM admin_transfers WHERE kind=$1 AND status IN ($2,$3) AND created_at < NOW() - INTERVAL \'1 minute\'', [kind, 'pending', 'otp']);
  for (const row of rowsOf(raw)) {
    try { const verified = await verifyAdminTransfer(row.reference); if (verified.notFound) await reverseAdminTransfer(row.id, 'Transfer not found at provider'); else await syncAdminTransfer(row.id, verified.data); }
    catch { /* leave pending when the provider cannot be reached */ }
  }
}
export async function syncAdminTransfer(id: string, data: any) {
  const status = normalizeProviderStatus(data?.status);
  await db.query(`UPDATE admin_transfers SET paystack_transfer_code=COALESCE($1,paystack_transfer_code), status=$2, processed_at=CASE WHEN $2 IN ('success','failed','reversed') THEN COALESCE(processed_at,NOW()) ELSE processed_at END, updated_at=NOW() WHERE id=$3`, [data?.transfer_code ?? null, status, id]);
  if (status === 'failed' || status === 'reversed') await db.query('SELECT fb_admin_reverse_transfer($1) AS result', [id]);
}
export function newAdminTransferIds(prefix: string) { return { id: `at_${nanoid(14)}`, reference: `${prefix}_${nanoid(20).toLowerCase()}` }; }
export { rowsOf };

