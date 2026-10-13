import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { db } from '@/lib/db';
import { getActiveBusinessForUser } from '@/lib/active-business';
import { nanoid } from 'nanoid';
import { reconcileBusinessWithdrawals, verifyAndSyncTransfer, reverseFailedWithdrawalIfNeeded, ALLOWED_STATUSES } from '@/lib/withdrawals';
import { FREE_WITHDRAWALS_PER_MONTH, OVERAGE_FEE_NGN, MIN_WITHDRAWAL_NGN } from '@/lib/withdrawal-policy';
import { watMonthStartUtc } from '@/lib/wat';
import { normalizeAmount, requireTicket } from '@/lib/security/pin';
import { getBankName } from '@/lib/banks';

const PAYSTACK_API_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';
function rowsOf(raw: any): any[] { return Array.isArray(raw) ? raw : raw?.rows ?? []; }
async function getUserId(req: NextRequest) { const token = req.headers.get('authorization')?.replace('Bearer ', '') || req.cookies.get('auth_token')?.value; if (!token) return null; const p = await verifyJWT(token); return p ? (p as any).userId || (p as any).id : null; }
function genReference() { return `wdr_${nanoid(20).toLowerCase()}`; }
class ProviderRejected extends Error {}
class ProviderUnreachable extends Error {}
async function providerJson(path: string, init: RequestInit): Promise<any> {
  let res: Response;
  try { res = await fetch(`${PAYSTACK_BASE}${path}`, init); } catch { throw new ProviderUnreachable('Payment provider unavailable'); }
  let json: any = {}; try { json = await res.json(); } catch { json = {}; }
  if (res.status >= 500) throw new ProviderUnreachable('Payment provider unavailable');
  if (!res.ok || !json.status) throw new ProviderRejected(json.message || 'Payment provider rejected the request');
  return json.data;
}
async function createRecipient(accountNumber: string, bankCode: string, name: string) { return providerJson('/transferrecipient', { method: 'POST', headers: { Authorization: `Bearer ${PAYSTACK_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'nuban', name, account_number: accountNumber, bank_code: bankCode, currency: 'NGN' }) }); }
async function initiateTransfer(recipient: string, amount: number, reference: string, reason: string) { return providerJson('/transfer', { method: 'POST', headers: { Authorization: `Bearer ${PAYSTACK_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ source: 'balance', amount: Math.round(amount * 100), recipient, reference, reason }) }); }

export async function GET(req: NextRequest) {
  const userId = await getUserId(req); if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const business = await getActiveBusinessForUser(userId); if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  try { await reconcileBusinessWithdrawals(business.id); } catch (error) { console.error('[v0] withdrawal reconciliation failed:', error); }
  const raw: any = await db.query(`SELECT id,amount,net_amount,status,bank_code,bank_account_number,bank_account_holder,payment_reference,reference,notes,requested_at,processed_at,created_at,updated_at FROM withdrawals WHERE business_id=$1 ORDER BY created_at DESC LIMIT 200`, [business.id]);
  const withdrawals = await Promise.all(
    rowsOf(raw).map(async (r: any) => ({
      id: r.id,
      amount: Number(r.amount),
      net_amount: r.net_amount == null ? null : Number(r.net_amount),
      status: r.status,
      bank_code: r.bank_code,
      bank_name: await getBankName(r.bank_code),
      bank_account_number: r.bank_account_number,
      bank_account_holder: r.bank_account_holder,
      payment_reference: r.payment_reference,
      reference: r.reference,
      notes: r.notes,
      requested_at: r.requested_at,
      processed_at: r.processed_at,
      created_at: r.created_at,
      updated_at: r.updated_at,
    })),
  );
  return NextResponse.json(withdrawals);
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req); if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!PAYSTACK_API_KEY) return NextResponse.json({ error: 'Paystack is not configured on this server.' }, { status: 500 });
  const business = await getActiveBusinessForUser(userId); if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  const body = await req.json(); const amount = Number(body.amount); const notes = String(body.notes || '').slice(0, 500);
  if (!Number.isFinite(amount) || amount < MIN_WITHDRAWAL_NGN) return NextResponse.json({ error: `Minimum withdrawal is ₦${MIN_WITHDRAWAL_NGN}` }, { status: 400 });
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return NextResponse.json({ error: 'Amount can have at most 2 decimal places' }, { status: 400 });
  const bankRaw: any = await db.query('SELECT bank_code,bank_account_number,bank_account_holder FROM businesses WHERE id=$1', [business.id]); const bank = rowsOf(bankRaw)[0];
  if (!bank?.bank_code || !bank?.bank_account_number || !bank?.bank_account_holder) return NextResponse.json({ error: 'Add your bank details first' }, { status: 400 });
  const authorized = await requireTicket({ ticket: body.authorizationTicket, userId, businessId: business.id, action: 'withdrawal', bind: { amount: normalizeAmount(amount), account: `${bank.bank_code}:${bank.bank_account_number}` } });
  if (!authorized) return NextResponse.json({ error: 'PIN authorization required', code: 'PIN_REQUIRED' }, { status: 403 });
  const withdrawalId = `wd_${nanoid(14)}`; const reference = genReference();
  const reserveRaw: any = await db.query('SELECT fb_reserve_withdrawal($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) AS result', [business.id, amount, withdrawalId, reference, bank.bank_code, bank.bank_account_number, bank.bank_account_holder, notes || null, watMonthStartUtc().toISOString(), FREE_WITHDRAWALS_PER_MONTH, OVERAGE_FEE_NGN, MIN_WITHDRAWAL_NGN]);
  const result = rowsOf(reserveRaw)[0]?.result; const reserve = typeof result === 'string' ? JSON.parse(result) : result || {};
  if (reserve.status === 'below_minimum') return NextResponse.json({ error: `Minimum withdrawal is ₦${MIN_WITHDRAWAL_NGN}` }, { status: 400 });
  if (reserve.status === 'business_not_found') return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  if (reserve.status === 'insufficient_balance') return NextResponse.json({ error: reserve.fee > 0 ? 'Insufficient available balance. A ₦500 fee applies from your 4th withdrawal this month' : 'Insufficient available balance' }, { status: 400 });
  if (reserve.status !== 'reserved') return NextResponse.json({ error: 'Withdrawal could not be reserved' }, { status: 400 });
  let recipientRaw: any = await db.query('SELECT id,recipient_code FROM transfer_recipients WHERE business_id=$1 AND account_number=$2 AND bank_code=$3 AND is_active=true LIMIT 1', [business.id, bank.bank_account_number, bank.bank_code]); let recipient = rowsOf(recipientRaw)[0];
  try {
    if (!recipient) { const created = await createRecipient(bank.bank_account_number, bank.bank_code, bank.bank_account_holder); const id = `tr_${nanoid(14)}`; await db.query(`INSERT INTO transfer_recipients (id,business_id,paystack_recipient_id,recipient_code,account_name,account_number,bank_code,account_type,is_active,created_at,updated_at) VALUES ($1,$2,$3,$3,$4,$5,$6,'nuban',true,NOW(),NOW())`, [id, business.id, created.recipient_code, bank.bank_account_holder, bank.bank_account_number, bank.bank_code]); recipient = { id, recipient_code: created.recipient_code }; }
    const transfer = await initiateTransfer(recipient.recipient_code, amount, reference, notes || 'Business withdrawal'); const status = ALLOWED_STATUSES.has(String(transfer.status).toLowerCase()) ? String(transfer.status).toLowerCase() : 'pending';
    await db.query(`UPDATE withdrawals SET transfer_recipient_id=$1,paystack_transfer_id=$2,transfer_code=$2,status=$3::withdrawal_status,processed_at=CASE WHEN $3 IN ('success','failed','reversed') THEN NOW() ELSE processed_at END,updated_at=NOW() WHERE id=$4`, [recipient.id, transfer.transfer_code, status, withdrawalId]);
    if (status === 'success') await db.query('SELECT fb_credit_withdrawal_fee($1) AS result', [withdrawalId]);
    return NextResponse.json({ success: true, withdrawalId, reference, status, withdrawalFee: Number(reserve.fee || 0), message: 'Withdrawal initiated' }, { status: 201 });
  } catch (error) {
    if (error instanceof ProviderRejected) { await db.query(`UPDATE withdrawals SET status='failed'::withdrawal_status,failure_reason=$1,updated_at=NOW() WHERE id=$2`, [error.message, withdrawalId]); await db.query('SELECT fb_reverse_failed_withdrawal($1) AS result', [withdrawalId]); return NextResponse.json({ error: error.message }, { status: 502 }); }
    const verified = await verifyAndSyncTransfer(reference, withdrawalId);
    if (verified?.notFound) { await db.query(`UPDATE withdrawals SET status='failed'::withdrawal_status,failure_reason=$1,updated_at=NOW() WHERE id=$2`, ['Transfer not found at provider', withdrawalId]); await db.query('SELECT fb_reverse_failed_withdrawal($1) AS result', [withdrawalId]); }
    return NextResponse.json({ success: true, withdrawalId, status: verified?.status || 'pending' }, { status: 202 });
  }
}
