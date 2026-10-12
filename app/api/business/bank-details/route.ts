import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTicket } from '@/lib/security/pin';
import { verifyJWT } from '@/lib/auth';
import { getActiveBusinessForUser } from '@/lib/active-business';

function rowsOf(raw: any): any[] { return Array.isArray(raw) ? raw : raw?.rows ?? []; }
async function getUserId(req: NextRequest) { const token = req.headers.get('authorization')?.replace('Bearer ', '') || req.cookies.get('auth_token')?.value; const payload = token ? await verifyJWT(token) : null; return payload ? (payload as any).userId || (payload as any).id : null; }

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req); if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const business = await getActiveBusinessForUser(userId); if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    const raw = await db.query('SELECT bank_account_number, bank_code, bank_account_holder FROM businesses WHERE id=$1', [business.id]); const row = rowsOf(raw)[0];
    return row ? NextResponse.json(row) : NextResponse.json({ error: 'Business not found' }, { status: 404 });
  } catch (error) { console.error('[v0] Failed to fetch bank details:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req); if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const business = await getActiveBusinessForUser(userId); if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    const body = await req.json(); const bankCode = String(body.bank_code || ''); const accountNumber = String(body.bank_account_number || body.account_number || '');
    if (!bankCode || !accountNumber) return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    const authorized = await requireTicket({ ticket: body.authorizationTicket, userId, businessId: business.id, action: 'bank_account', bind: { bank_code: bankCode, account_number: accountNumber } });
    if (!authorized) return NextResponse.json({ error: 'PIN authorization required', code: 'PIN_REQUIRED' }, { status: 403 });
    const secret = process.env.PAYSTACK_SECRET_KEY; if (!secret) return NextResponse.json({ error: 'Could not verify this bank account' }, { status: 400 });
    const response = await fetch(`https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`, { headers: { Authorization: `Bearer ${secret}` } });
    const resolved = await response.json(); const holder = resolved?.status && resolved?.data?.account_name;
    if (!response.ok || !holder) return NextResponse.json({ error: 'Could not verify this bank account' }, { status: 400 });
    const raw = await db.query('UPDATE businesses SET bank_code=$1, bank_account_number=$2, bank_account_holder=$3 WHERE id=$4 RETURNING id', [bankCode, accountNumber, holder, business.id]);
    if (!rowsOf(raw).length) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    return NextResponse.json({ message: 'Bank details updated' });
  } catch (error) { console.error('[v0] Failed to update bank details:', error); return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
