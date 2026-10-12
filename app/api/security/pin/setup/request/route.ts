import crypto from 'node:crypto';
import { nanoid } from 'nanoid';
import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { db } from '@/lib/db';
import { hashPin } from '@/lib/pin-utils';
import { sendPINSetupEmail } from '@/lib/email';
function rowsOf(raw: any): any[] { return Array.isArray(raw) ? raw : raw?.rows ?? []; }
async function uid(req: NextRequest) { const t = req.headers.get('authorization')?.replace('Bearer ', '') || req.cookies.get('auth_token')?.value; const p = t ? await verifyJWT(t) : null; return p ? (p as any).userId || (p as any).id : null; }
export async function POST(req: NextRequest) {
  try {
    const userId = await uid(req); if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const countRaw = await db.query("SELECT count(*)::int AS count FROM pin_reset_codes WHERE user_id=$1 AND created_at > now() - interval '1 hour'", [userId]);
    if (Number(rowsOf(countRaw)[0]?.count || 0) >= 3) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    const userRaw = await db.query('SELECT email, first_name FROM users WHERE id=$1', [userId]); const user = rowsOf(userRaw)[0];
    if (!user?.email) return NextResponse.json({ error: 'User email not found' }, { status: 400 });
    const code = String(crypto.randomInt(100000, 1000000)); const codeId = `prc_${nanoid(14)}`; const codeHash = await hashPin(code);
    await db.query("INSERT INTO pin_reset_codes (id,user_id,code_hash,expires_at) VALUES ($1,$2,$3,now()+interval '10 minutes')", [codeId, userId, codeHash]);
    if (!(await sendPINSetupEmail(user.email, code, user.first_name || 'there'))) return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 });
    return NextResponse.json({ codeId });
  } catch (error) { console.error('[v0] PIN setup request failed'); return NextResponse.json({ error: 'Failed to send verification email' }, { status: 500 }); }
}
