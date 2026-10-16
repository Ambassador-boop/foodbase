import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { getActiveBusinessForUser } from '@/lib/active-business';
import { db } from '@/lib/db';
import { normalizeAmount, verifyPinAndIssueTicket } from '@/lib/security/pin';

const rowsOf = (raw: any): any[] => Array.isArray(raw) ? raw : raw?.rows ?? [];
async function identity(req: NextRequest) { const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.cookies.get('auth_token')?.value; return token ? await verifyJWT(token) : null; }

export async function POST(req: NextRequest) {
  try {
    const payload: any = await identity(req); const uid = payload?.userId || payload?.sub;
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json(); const action = String(body.action || ''); const params = body.params || {}; const pin = String(body.pin || '');
    const adminActions = ['sms_funding', 'admin_withdrawal', 'bank_account'];
    const businessActions = ['withdrawal', 'refund', 'password_change', 'profile_update'];
    if (![...adminActions, ...businessActions].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    if (!/^\d{4,6}$/.test(pin)) return NextResponse.json({ error: 'PIN must be 4 to 6 digits' }, { status: 400 });
    const isAdmin = payload.role === 'admin';
    if (isAdmin && businessActions.includes(action)) return NextResponse.json({ error: 'Invalid admin action' }, { status: 403 });
    if (!isAdmin && adminActions.includes(action)) return NextResponse.json({ error: 'Invalid business action' }, { status: 403 });
    let businessId: string | null = null; let bind: Record<string, string>;
    if (isAdmin) {
      if (action === 'bank_account') bind = { bank_code: String(params.bank_code), account_number: String(params.account_number) };
      else if (action === 'sms_funding') bind = { amount: normalizeAmount(params.amount) };
      else { const bank = rowsOf(await db.query('SELECT bank_code, account_number FROM admin_bank_details WHERE is_active = TRUE LIMIT 1'))[0]; if (!bank) return NextResponse.json({ error: 'Add your bank details first' }, { status: 400 }); bind = { amount: normalizeAmount(params.amount), account: `${bank.bank_code}:${bank.account_number}` }; }
    } else {
      const business = await getActiveBusinessForUser(uid); if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 }); businessId = business.id;
      if (action === 'withdrawal') { const bank = rowsOf(await db.query('SELECT bank_code, bank_account_number FROM businesses WHERE id=$1', [business.id]))[0]; if (!bank?.bank_code || !bank?.bank_account_number) return NextResponse.json({ error: 'Add your bank details first' }, { status: 400 }); bind = { amount: normalizeAmount(params.amount), account: `${bank.bank_code}:${bank.bank_account_number}` }; }
      else if (action === 'refund') bind = { order_id: String(params.orderId), amount: normalizeAmount(params.amount) };
      else if (action === 'bank_account') bind = { bank_code: String(params.bank_code), account_number: String(params.account_number) };
      else if (action === 'password_change') bind = {}; else bind = { first_name: String(params.first_name || '').trim(), last_name: String(params.last_name || '').trim(), phone: String(params.phone || '').trim() };
    }
    const result = await verifyPinAndIssueTicket({ userId: String(uid), businessId, action, bind, pin });
    if (!result.ok && result.code === 'LOCKED') return NextResponse.json({ error: 'Too many wrong attempts. Try again later.', code: 'LOCKED', lockedUntil: result.lockedUntil }, { status: 429 });
    if (!result.ok && result.code === 'PIN_NOT_SET') return NextResponse.json({ code: 'PIN_NOT_SET', error: 'Create a PIN first' }, { status: 409 });
    if (!result.ok) return NextResponse.json({ code: 'WRONG_PIN', error: 'Incorrect PIN', attemptsLeft: result.attemptsLeft }, { status: 401 });
    return NextResponse.json({ ticket: result.ticket, expiresInSeconds: 300 });
  } catch { return NextResponse.json({ error: 'Failed to authorize action' }, { status: 500 }); }
}
