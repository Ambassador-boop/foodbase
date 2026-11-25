import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyJWT } from '@/lib/auth';
import { getActiveBusinessForUser } from '@/lib/active-business';
import { db } from '@/lib/db';
import { normalizeAmount, verifyPinAndIssueTicket } from '@/lib/security/pin';
import { parseBody, fail } from '@/lib/api';
import { handleUnexpected } from '@/lib/api/handler';

const rowsOf = (raw: any): any[] => Array.isArray(raw) ? raw : raw?.rows ?? [];
async function identity(req: NextRequest) { const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || req.cookies.get('auth_token')?.value; return token ? await verifyJWT(token) : null; }

const ADMIN_ACTIONS = ['sms_funding', 'admin_withdrawal', 'bank_account'] as const;
const BUSINESS_ACTIONS = ['withdrawal', 'refund', 'password_change', 'profile_update'] as const;

/**
 * The body: an action name, a PIN, and the loose bag of parameters each action
 * needs. The bag stays loose because each action reads its own two or three
 * values; the action name and the PIN are what must be exact.
 */
const AuthorizeBody = z.object({
  action: z.enum([...ADMIN_ACTIONS, ...BUSINESS_ACTIONS], {
    errorMap: () => ({ message: 'Invalid action' }),
  }),
  pin: z.string().regex(/^\d{4,6}$/, 'PIN must be 4 to 6 digits'),
  params: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const payload: any = await identity(req); const uid = payload?.userId || payload?.sub;
    if (!uid) return fail('UNAUTHORIZED', 'Unauthorized', 401);

    const parsed = await parseBody(req, AuthorizeBody, 'Check the action and your PIN.');
    if (!parsed.ok) return parsed.response;
    const { action, pin } = parsed.data;
    const params = (parsed.data.params ?? {}) as Record<string, unknown>;

    const isAdmin = payload.role === 'admin';
    const isAdminAction = (ADMIN_ACTIONS as readonly string[]).includes(action);
    const isBusinessAction = (BUSINESS_ACTIONS as readonly string[]).includes(action);
    if (isAdmin && isBusinessAction) return fail('INVALID_ACTION', 'Invalid admin action', 403);
    if (!isAdmin && isAdminAction) return fail('INVALID_ACTION', 'Invalid business action', 403);

    let businessId: string | null = null; let bind: Record<string, string>;
    if (isAdmin) {
      if (action === 'bank_account') bind = { bank_code: String(params.bank_code), account_number: String(params.account_number) };
      else if (action === 'sms_funding') bind = { amount: normalizeAmount(params.amount) };
      else { const bank = rowsOf(await db.query('SELECT bank_code, account_number FROM admin_bank_details WHERE is_active = TRUE LIMIT 1'))[0]; if (!bank) return fail('BANK_DETAILS_REQUIRED', 'Add your bank details first', 400); bind = { amount: normalizeAmount(params.amount), account: `${bank.bank_code}:${bank.account_number}` }; }
    } else {
      const business = await getActiveBusinessForUser(uid); if (!business) return fail('BUSINESS_NOT_FOUND', 'Business not found', 404); businessId = business.id;
      if (action === 'withdrawal') { const bank = rowsOf(await db.query('SELECT bank_code, bank_account_number FROM businesses WHERE id=$1', [business.id]))[0]; if (!bank?.bank_code || !bank?.bank_account_number) return fail('BANK_DETAILS_REQUIRED', 'Add your bank details first', 400); bind = { amount: normalizeAmount(params.amount), account: `${bank.bank_code}:${bank.bank_account_number}` }; }
      else if (action === 'refund') bind = { order_id: String(params.orderId), amount: normalizeAmount(params.amount) };
      else if (action === 'bank_account') bind = { bank_code: String(params.bank_code), account_number: String(params.account_number) };
      else if (action === 'password_change') bind = {}; else bind = { first_name: String(params.first_name || '').trim(), last_name: String(params.last_name || '').trim(), phone: String(params.phone || '').trim() };
    }

    const result = await verifyPinAndIssueTicket({ userId: String(uid), businessId, action, bind, pin });
    if (!result.ok && result.code === 'LOCKED') return fail('LOCKED', 'Too many wrong attempts. Try again later.', 429, undefined, { lockedUntil: result.lockedUntil });
    if (!result.ok && result.code === 'PIN_NOT_SET') return fail('PIN_NOT_SET', 'Create a PIN first', 409);
    if (!result.ok) return fail('WRONG_PIN', 'Incorrect PIN', 401, undefined, { attemptsLeft: result.attemptsLeft });
    return NextResponse.json({ ticket: result.ticket, expiresInSeconds: 300 });
  } catch (error) { return handleUnexpected(error, { where: 'POST /api/security/authorize', request: req }); }
}
