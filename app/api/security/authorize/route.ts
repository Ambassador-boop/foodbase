import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { getActiveBusinessForUser } from '@/lib/active-business';
import { db } from '@/lib/db';
import { normalizeAmount, verifyPinAndIssueTicket } from '@/lib/security/pin';

async function userId(req: NextRequest) { const token = req.headers.get('authorization')?.replace('Bearer ', '') || req.cookies.get('auth_token')?.value; const p = token ? await verifyJWT(token) : null; return p ? (p as any).userId || (p as any).id : null; }
function rowsOf(raw: any): any[] { return Array.isArray(raw) ? raw : raw?.rows ?? []; }
export async function POST(req: NextRequest) {
  try {
    const uid = await userId(req); if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const business = await getActiveBusinessForUser(uid); if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    const body = await req.json(); const action = String(body.action || ''); const params = body.params || {}; const pin = String(body.pin || '');
    if (!['withdrawal', 'refund', 'bank_account'].includes(action)) return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    if (!/^\d{4,6}$/.test(pin)) return NextResponse.json({ error: 'PIN must be 4 to 6 digits' }, { status: 400 });
    let bind: Record<string, string>;
    if (action === 'withdrawal') {
      const raw = await db.query('SELECT bank_code, bank_account_number FROM businesses WHERE id=$1', [business.id]); const bank = rowsOf(raw)[0];
      if (!bank?.bank_code || !bank?.bank_account_number) return NextResponse.json({ error: 'Add your bank details first' }, { status: 400 });
      bind = { amount: normalizeAmount(params.amount), account: `${bank.bank_code}:${bank.bank_account_number}` };
    } else if (action === 'refund') bind = { order_id: String(params.orderId), amount: normalizeAmount(params.amount) };
    else bind = { bank_code: String(params.bank_code), account_number: String(params.account_number) };
    const result = await verifyPinAndIssueTicket({ userId: uid, businessId: business.id, action, bind, pin });
    if (!result.ok && result.code === 'LOCKED') return NextResponse.json({ error: 'Too many wrong attempts. Try again later.', code: 'LOCKED', lockedUntil: result.lockedUntil }, { status: 429 });
    if (!result.ok && result.code === 'PIN_NOT_SET') return NextResponse.json({ code: 'PIN_NOT_SET', error: 'Create a PIN first' }, { status: 409 });
    if (!result.ok) return NextResponse.json({ code: 'WRONG_PIN', error: 'Incorrect PIN', attemptsLeft: result.attemptsLeft }, { status: 401 });
    return NextResponse.json({ ticket: result.ticket, expiresInSeconds: 300 });
  } catch (error) { console.error('[v0] PIN authorization failed'); return NextResponse.json({ error: 'Failed to authorize action' }, { status: 500 }); }
}
