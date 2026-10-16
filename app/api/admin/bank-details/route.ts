import { NextRequest, NextResponse } from 'next/server';
import { getOne, query } from '@/lib/db';
import { requireAdmin, isAdminAuth } from '@/lib/admin-auth';
import { requireTicket } from '@/lib/security/pin';

const paystack = (path: string, init?: RequestInit) => fetch(`https://api.paystack.co${path}`, { ...init, headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json', ...(init?.headers || {}) }, cache: 'no-store' });

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req); if (!isAdminAuth(auth)) return auth;
    const row = await getOne('SELECT id, bank_code, account_number, account_name, paystack_recipient_id, is_active, created_at FROM admin_bank_details WHERE is_active = TRUE LIMIT 1');
    return NextResponse.json(row);
  } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req); if (!isAdminAuth(auth)) return auth;
    const body = await req.json(); const bankCode = String(body.bank_code || ''); const accountNumber = String(body.account_number || '');
    if (!bankCode || !/^\d{10}$/.test(accountNumber)) return NextResponse.json({ error: 'A valid 10-digit account number and bank code are required' }, { status: 400 });
    const authorized = await requireTicket({ ticket: body.authorizationTicket, userId: auth.userId, businessId: null, action: 'bank_account', bind: { bank_code: bankCode, account_number: accountNumber } });
    if (!authorized) return NextResponse.json({ code: 'PIN_REQUIRED', error: 'PIN authorization required' }, { status: 403 });
    const resolved = await paystack(`/bank/resolve?account_number=${accountNumber}&bank_code=${encodeURIComponent(bankCode)}`);
    const resolvedBody = await resolved.json();
    if (!resolved.ok || !resolvedBody.status || !resolvedBody.data?.account_name) return NextResponse.json({ error: 'Unable to resolve bank account' }, { status: 400 });
    await query('UPDATE admin_bank_details SET is_active = FALSE');
    const row = await getOne('INSERT INTO admin_bank_details (bank_code, account_number, account_name, paystack_recipient_id, is_active) VALUES ($1,$2,$3,NULL,TRUE) RETURNING id, bank_code, account_number, account_name, paystack_recipient_id, is_active', [bankCode, accountNumber, resolvedBody.data.account_name]);
    return NextResponse.json(row);
  } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
