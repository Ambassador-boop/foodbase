import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyJWT } from '@/lib/auth'
import { requireTicket } from '@/lib/security/pin'

function tokenOf(request: NextRequest) { return request.headers.get('authorization')?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value }
function rowsOf(raw: any): any[] { return Array.isArray(raw) ? raw : raw?.rows ?? [] }
async function auth(request: NextRequest) { const token = tokenOf(request); return token ? verifyJWT(token) : null }
export async function GET(request: NextRequest) {
  try { const payload = await auth(request); if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); const rows = rowsOf(await db.query('SELECT id, email, first_name, last_name, phone, profile_picture_url FROM users WHERE id = $1', [payload.userId])); return rows.length ? NextResponse.json({ user: rows[0] }) : NextResponse.json({ error: 'User not found' }, { status: 404 }); }
  catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }) }
}
export async function PATCH(request: NextRequest) {
  try {
    const payload = await auth(request); if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await request.json(); const first_name = String(body.first_name || '').trim(); const last_name = String(body.last_name || '').trim(); const phone = String(body.phone || '').trim();
    if (!/^.{1,60}$/.test(first_name) || !/^.{1,60}$/.test(last_name) || !/^\+?\d{7,15}$/.test(phone)) return NextResponse.json({ error: 'Invalid profile details' }, { status: 400 });
    const business = rowsOf(await db.query('SELECT id FROM businesses WHERE owner_id=$1 AND is_active=true ORDER BY created_at ASC LIMIT 1', [payload.userId]))[0]; if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    if (!await requireTicket({ ticket: body.authorizationTicket, userId: String(payload.userId), businessId: business.id, action: 'profile_update', bind: { first_name, last_name, phone } })) return NextResponse.json({ error: 'PIN authorization required', code: 'PIN_REQUIRED' }, { status: 403 });
    const rows = rowsOf(await db.query('UPDATE users SET first_name=$1,last_name=$2,phone=$3,updated_at=NOW() WHERE id=$4 RETURNING id,email,first_name,last_name,phone,profile_picture_url', [first_name, last_name, phone, payload.userId]));
    return rows.length ? NextResponse.json({ user: rows[0] }) : NextResponse.json({ error: 'User not found' }, { status: 404 });
  } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }) }
}
