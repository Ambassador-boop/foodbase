import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyJWT } from '@/lib/auth';

export async function requireAdmin(req: NextRequest): Promise<{ userId: string } | NextResponse> {
  const token = await getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJWT(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (payload.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const userId = String(payload.userId || payload.sub || '');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return { userId };
}

export function isAdminAuth(value: { userId: string } | NextResponse): value is { userId: string } {
  return 'userId' in value;
}

export function paystackHeaders() {
  return { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' };
}

export function errorReason(payload: any, fallback = 'Paystack request failed') {
  return String(payload?.message || payload?.error || fallback).slice(0, 500);
}

export async function paystackJson(path: string, init?: RequestInit) {
  const response = await fetch(`https://api.paystack.co${path}`, { ...init, headers: { ...paystackHeaders(), ...(init?.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

export function paystackFailure(response: Response, payload: any) { return !response.ok || payload?.status === false; }
export function isTransientPaystackFailure(error: unknown, response?: Response) { return !response || response.status >= 500 || error instanceof Error; }

export async function verifyPaystackTransfer(reference: string) {
  return paystackJson(`/transfer/verify/${encodeURIComponent(reference)}`);
}

export function normalizedTransferStatus(payload: any) { return String(payload?.data?.status || payload?.status || 'pending').toLowerCase(); }
export function transferCode(payload: any) { return payload?.data?.transfer_code || payload?.data?.id || null; }
export function kobo(amount: number) { return Math.round(amount * 100); }

export type AdminTransferTarget = { bankCode: string; accountNumber: string; accountName: string };

export async function createPaystackTransfer(target: AdminTransferTarget, amount: number, reference: string) {
  const recipient = await paystackJson('/transferrecipient', { method: 'POST', body: JSON.stringify({ type: 'nuban', name: target.accountName, account_number: target.accountNumber, bank_code: target.bankCode, currency: 'NGN' }) });
  if (paystackFailure(recipient.response, recipient.payload)) return { kind: 'rejected' as const, reason: errorReason(recipient.payload), response: recipient.response, payload: recipient.payload };
  const transfer = await paystackJson('/transfer', { method: 'POST', body: JSON.stringify({ source: 'balance', amount: kobo(amount), recipient: recipient.payload.data.recipient_code, reference }) });
  if (paystackFailure(transfer.response, transfer.payload)) return { kind: 'rejected' as const, reason: errorReason(transfer.payload), response: transfer.response, payload: transfer.payload };
  return { kind: 'success' as const, payload: transfer.payload, response: transfer.response };
}

export async function verifyAfterTransient(reference: string) {
  try {
    const verified = await verifyPaystackTransfer(reference);
    if (verified.response.ok && verified.payload?.status !== false) return { found: true, status: normalizedTransferStatus(verified.payload), code: transferCode(verified.payload) };
    if (verified.response.status === 404 || /not found/i.test(errorReason(verified.payload))) return { found: false };
  } catch { /* leave reserved transfer pending */ }
  return null;
}

export function amountIsValid(amount: unknown, minimum: number) { return typeof amount === 'number' && Number.isFinite(amount) && amount >= minimum && Math.round(amount * 100) === amount * 100; }

export function rowsOf(raw: any): any[] { return Array.isArray(raw) ? raw : raw?.rows ?? []; }
export function jsonResult(value: any): any { return typeof value === 'string' ? JSON.parse(value) : value ?? {}; }

export async function finalizeAdminTransfer(db: any, id: string, status: string, code?: string | null) {
  await db.query('UPDATE admin_transfers SET status=$1, paystack_transfer_code=COALESCE($2,paystack_transfer_code), processed_at=CASE WHEN $1=\'success\' THEN NOW() ELSE processed_at END WHERE id=$3', [status, code || null, id]);
  if (status === 'failed' || status === 'reversed') await db.query('SELECT fb_admin_reverse_transfer($1)', [id]);
}
