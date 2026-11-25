import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { db } from '@/lib/db';
import { comparePin, hashPin } from '@/lib/pin-utils';
import { z } from 'zod';
import { parseBody, fail } from '@/lib/api';
import { handleUnexpected } from '@/lib/api/handler';

/** The code emailed to the owner and the new PIN. */
const ConfirmPinBody = z.object({
  codeId: z.string().trim().min(1).max(100),
  code: z.string().trim().regex(/^\d{4,8}$/, 'Enter the code from your email'),
  newPin: z.string().trim().min(4).max(8),
});
function rowsOf(raw: any): any[] { return Array.isArray(raw) ? raw : raw?.rows ?? []; }
function validPin(pin: string) {
  return /^\d{6}$/.test(pin) && !/^([0-9])\1{5}$/.test(pin) && !['012345', '123456', '234567', '345678', '456789', '987654', '876543', '765432', '654321', '543210'].includes(pin);
}
export async function POST(req: NextRequest) {
  try {
    const t = req.headers.get('authorization')?.replace('Bearer ', '') || req.cookies.get('auth_token')?.value; const p = t ? await verifyJWT(t) : null; const uid = p && ((p as any).userId || (p as any).id);
    if (!uid) return fail('UNAUTHORIZED', 'Unauthorized', 401);

    const parsed = await parseBody(req, ConfirmPinBody, 'Check the code and your new PIN.');
    if (!parsed.ok) return parsed.response;
    const { codeId, code, newPin } = parsed.data;
    if (!validPin(String(newPin || ''))) return fail('INVALID_PIN', 'PIN must be a valid 6-digit PIN', 400);
    const raw = await db.query('UPDATE pin_reset_codes SET attempts=attempts+1 WHERE id=$1 AND user_id=$2 AND consumed_at IS NULL AND expires_at > now() AND attempts < 5 RETURNING code_hash', [codeId, uid]); const row = rowsOf(raw)[0];
    if (!row) return fail('CODE_EXPIRED', 'Code expired or too many attempts', 400);
    if (!(await comparePin(String(code), row.code_hash))) return fail('CODE_INCORRECT', 'Incorrect code', 400);
    await db.query('UPDATE pin_reset_codes SET consumed_at=now() WHERE id=$1', [codeId]); await db.query('SELECT fb_pin_set($1,$2)', [uid, await hashPin(String(newPin))]);
    return NextResponse.json({ success: true });
  } catch (error) { return handleUnexpected(error, { where: 'POST /api/security/pin/setup/confirm', request: req }); }
}
