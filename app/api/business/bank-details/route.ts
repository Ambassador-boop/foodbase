import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireTicket } from '@/lib/security/pin';
import { verifyJWT } from '@/lib/auth';
import { getActiveBusinessForUser } from '@/lib/active-business';
import { getBankName } from '@/lib/banks';
import { env } from '@/lib/env';
import { z } from 'zod';
import { fail, parseBody } from '@/lib/api';

function rowsOf(raw: any): any[] { return Array.isArray(raw) ? raw : raw?.rows ?? []; }
async function getUserId(req: NextRequest) { const token = req.headers.get('authorization')?.replace('Bearer ', '') || req.cookies.get('auth_token')?.value; const payload = token ? await verifyJWT(token) : null; return payload ? (payload as any).userId || (payload as any).id : null; }

/** Where a business's payouts go. Changing it requires a PIN ticket. */
const BusinessBankBody = z.object({
  bank_code: z.string().trim().regex(/^\d{3,6}$/, 'Invalid bank details'),
  bank_account_number: z.string().trim().regex(/^\d{10}$/, 'Invalid bank details').optional(),
  account_number: z.string().trim().regex(/^\d{10}$/, 'Invalid bank details').optional(),
  authorizationTicket: z.string().max(200).optional(),
}).refine((value) => Boolean(value.bank_account_number || value.account_number), {
  message: 'Invalid bank details',
  path: ['bank_account_number'],
});

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req); if (!userId) return fail('UNAUTHORIZED', 'Unauthorized', 401);
    const business = await getActiveBusinessForUser(userId); if (!business) return fail('BUSINESS_FOUND', 'Business not found', 404);
    const raw = await db.query('SELECT bank_account_number, bank_code, bank_account_holder FROM businesses WHERE id=$1', [business.id]); const row = rowsOf(raw)[0];
    return row ? NextResponse.json({ ...row, bank_name: await getBankName(row.bank_code) }) : fail('BUSINESS_FOUND', 'Business not found', 404);
  } catch (error) { console.error('[v0] Failed to fetch bank details:', error); return fail('INTERNAL_SERVER_ERROR', 'Internal server error', 500); }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req); if (!userId) return fail('UNAUTHORIZED', 'Unauthorized', 401);
    const business = await getActiveBusinessForUser(userId); if (!business) return fail('BUSINESS_FOUND', 'Business not found', 404);
    const parsed = await parseBody(req, BusinessBankBody, 'Check the bank details.');
    if (!parsed.ok) return parsed.response;
    const body = parsed.data;
    const bankCode = body.bank_code;
    const accountNumber = String(body.bank_account_number || body.account_number || '');
    const authorized = await requireTicket({ ticket: body.authorizationTicket, userId, businessId: business.id, action: 'bank_account', bind: { bank_code: bankCode, account_number: accountNumber } });
    if (!authorized) return fail('PIN_REQUIRED', 'PIN authorization required', 403);
    const secret = env.PAYSTACK_SECRET_KEY; if (!secret) return fail('COULD_VERIFY_BANK', 'Could not verify this bank account', 400);
    const response = await fetch(`https://api.paystack.co/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`, { headers: { Authorization: `Bearer ${secret}` } });
    const resolved = await response.json(); const holder = resolved?.status && resolved?.data?.account_name;
    if (!response.ok || !holder) return fail('COULD_VERIFY_BANK', 'Could not verify this bank account', 400);
    const raw = await db.query('UPDATE businesses SET bank_code=$1, bank_account_number=$2, bank_account_holder=$3 WHERE id=$4 RETURNING id', [bankCode, accountNumber, holder, business.id]);
    if (!rowsOf(raw).length) return fail('BUSINESS_FOUND', 'Business not found', 404);
    return NextResponse.json({ message: 'Bank details updated' });
  } catch (error) { console.error('[v0] Failed to update bank details:', error); return fail('INTERNAL_SERVER_ERROR', 'Internal server error', 500); }
}
