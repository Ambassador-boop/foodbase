import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, isAdminAuth } from '@/lib/admin-auth';
import { normalizeAmount, requireTicket } from '@/lib/security/pin';
import { createAdminRecipient, initiateAdminTransfer, newAdminTransferIds, ProviderRejected, ProviderUnreachable, reconcileAdminTransfers, reverseAdminTransfer, rowsOf, syncAdminTransfer, verifyAdminTransfer } from '@/lib/admin-transfers';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req); if (!isAdminAuth(auth)) return auth;
  try {
    await reconcileAdminTransfers('admin_withdrawal');
    const legacy: any = await db.query('SELECT id,amount,bank_code,account_number,account_name,paystack_transfer_id,status,created_at,updated_at FROM admin_withdrawals ORDER BY created_at DESC');
    const transfers: any = await db.query("SELECT id,amount,bank_code,account_number,account_name,paystack_transfer_code AS paystack_transfer_id,status,created_at,updated_at FROM admin_transfers WHERE kind='admin_withdrawal' ORDER BY created_at DESC");
    return NextResponse.json([...rowsOf(legacy).map((r) => ({ ...r, source: 'legacy' })), ...rowsOf(transfers).map((r) => ({ ...r, source: 'transfer' }))]);
  } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req); if (!isAdminAuth(auth)) return auth;
  let transferId = ''; let body: any;
  try {
    body = await req.json(); const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 100) return NextResponse.json({ error: 'Minimum withdrawal is ₦100' }, { status: 400 });
    if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return NextResponse.json({ error: 'Amount can have at most 2 decimal places' }, { status: 400 });
    const bankRaw: any = await db.query('SELECT bank_code,account_number,account_name FROM admin_bank_details WHERE is_active=true LIMIT 1'); const bank = rowsOf(bankRaw)[0];
    if (!bank) return NextResponse.json({ error: 'Bank Account Not Set Up' }, { status: 400 });
    const bind = { amount: normalizeAmount(amount), account: `${bank.bank_code}:${bank.account_number}` };
    if (!(await requireTicket({ ticket: body.authorizationTicket, userId: auth.userId, businessId: null, action: 'admin_withdrawal', bind }))) return NextResponse.json({ error: 'PIN authorization required', code: 'PIN_REQUIRED' }, { status: 403 });
    const ids = newAdminTransferIds('adm'); transferId = ids.id;
    const reservedRaw: any = await db.query('SELECT fb_admin_reserve_transfer($1,$2,$3,$4,$5,$6,$7,$8,$9) AS result', ['admin_withdrawal', amount, ids.id, ids.reference, bank.bank_code, bank.account_number, bank.account_name, auth.userId, 100]);
    const reserved = typeof rowsOf(reservedRaw)[0]?.result === 'string' ? JSON.parse(rowsOf(reservedRaw)[0].result) : rowsOf(reservedRaw)[0]?.result || {};
    if (reserved.status === 'below_minimum') return NextResponse.json({ error: 'Minimum withdrawal is ₦100' }, { status: 400 });
    if (reserved.status === 'insufficient_balance') return NextResponse.json({ error: 'Insufficient available balance' }, { status: 400 });
    if (reserved.status !== 'reserved') return NextResponse.json({ error: 'Withdrawal could not be reserved' }, { status: 400 });
    try {
      if (!process.env.PAYSTACK_SECRET_KEY) throw new ProviderUnreachable('Paystack is not configured');
      const recipient = await createAdminRecipient(bank.account_number, bank.bank_code, bank.account_name);
      const transfer = await initiateAdminTransfer(recipient.recipient_code, amount, ids.reference, 'Platform revenue withdrawal');
      await syncAdminTransfer(ids.id, transfer);
      return NextResponse.json({ success: true, transferId: ids.id, status: String(transfer.status || 'pending').toLowerCase() }, { status: 201 });
    } catch (error) {
      if (error instanceof ProviderRejected) { await reverseAdminTransfer(ids.id, error.message); return NextResponse.json({ error: error.message }, { status: 502 }); }
      try { const verified = await verifyAdminTransfer(ids.reference); if (verified.notFound) { await reverseAdminTransfer(ids.id, 'Transfer not found at provider'); return NextResponse.json({ error: 'Transfer not found at provider' }, { status: 502 }); } await syncAdminTransfer(ids.id, verified.data); return NextResponse.json({ success: true, transferId: ids.id, status: String(verified.data?.status || 'pending').toLowerCase() }, { status: 202 }); }
      catch { return NextResponse.json({ success: true, transferId: ids.id, status: 'pending' }, { status: 202 }); }
    }
  } catch { if (transferId) { /* reserved row remains pending when request state is uncertain */ } return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
