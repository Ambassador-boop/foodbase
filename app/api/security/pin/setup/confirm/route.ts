import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { db } from '@/lib/db';
import { comparePin, hashPin } from '@/lib/pin-utils';
function rowsOf(raw: any): any[] { return Array.isArray(raw) ? raw : raw?.rows ?? []; }
function validPin(pin: string) {
  return /^\d{6}$/.test(pin) && !/^([0-9])\1{5}$/.test(pin) && !['012345', '123456', '234567', '345678', '456789', '987654', '876543', '765432', '654321', '543210'].includes(pin);
}
export async function POST(req: NextRequest) {
  try {
    const t = req.headers.get('authorization')?.replace('Bearer ', '') || req.cookies.get('auth_token')?.value; const p = t ? await verifyJWT(t) : null; const uid = p && ((p as any).userId || (p as any).id);
    if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { codeId, code, newPin } = await req.json(); if (!validPin(String(newPin || ''))) return NextResponse.json({ error: 'PIN must be a valid 6-digit PIN' }, { status: 400 });
    const raw = await db.query('UPDATE pin_reset_codes SET attempts=attempts+1 WHERE id=$1 AND user_id=$2 AND consumed_at IS NULL AND expires_at > now() AND attempts < 5 RETURNING code_hash', [codeId, uid]); const row = rowsOf(raw)[0];
    if (!row) return NextResponse.json({ error: 'Code expired or too many attempts' }, { status: 400 });
    if (!(await comparePin(String(code), row.code_hash))) return NextResponse.json({ error: 'Incorrect code' }, { status: 400 });
    await db.query('UPDATE pin_reset_codes SET consumed_at=now() WHERE id=$1', [codeId]); await db.query('SELECT fb_pin_set($1,$2)', [uid, await hashPin(String(newPin))]);
    return NextResponse.json({ success: true });
  } catch (error) { console.error('[v0] PIN setup confirmation failed'); return NextResponse.json({ error: 'Failed to confirm PIN setup' }, { status: 500 }); }
}
