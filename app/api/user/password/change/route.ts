import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT, verifyPassword, hashPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { requireTicket } from '@/lib/security/pin';

function getUserId(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || req.cookies.get('auth_token')?.value;
  return token ? verifyJWT(token).then((p) => p ? String((p as any).userId || (p as any).id) : null) : Promise.resolve(null);
}
function rowsOf(raw: any): any[] { return Array.isArray(raw) ? raw : raw?.rows ?? []; }
export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req); if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const rate = await db.query("SELECT fb_rate_limit('pwchange:' || $1, 5, 900) AS allowed", [userId]);
    if (!Boolean(rowsOf(rate)[0]?.allowed)) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    const body = await req.json();
    const currentPassword = String(body.currentPassword || ''); const newPassword = String(body.newPassword || ''); const confirmPassword = String(body.confirmPassword || '');
    if (newPassword.length < 8) return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    if (newPassword !== confirmPassword) return NextResponse.json({ error: 'Passwords do not match' }, { status: 400 });
    const user = rowsOf(await db.query('SELECT password_hash FROM users WHERE id=$1', [userId]))[0];
    if (!user || !(await verifyPassword(currentPassword, user.password_hash))) return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
    if (newPassword === currentPassword) return NextResponse.json({ error: 'New password must be different' }, { status: 400 });
    const business = rowsOf(await db.query('SELECT id FROM businesses WHERE owner_id=$1 AND is_active=true ORDER BY created_at ASC LIMIT 1', [userId]))[0];
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    if (!await requireTicket({ ticket: body.authorizationTicket, userId, businessId: business.id, action: 'password_change', bind: {} })) return NextResponse.json({ error: 'PIN authorization required', code: 'PIN_REQUIRED' }, { status: 403 });
    const hash = await hashPassword(newPassword);
    await db.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, userId]);
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
