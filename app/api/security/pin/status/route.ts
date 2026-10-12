import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { getPinStatus } from '@/lib/security/pin';
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || req.cookies.get('auth_token')?.value;
  const p = token ? await verifyJWT(token) : null; const uid = p && ((p as any).userId || (p as any).id);
  if (!uid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json(await getPinStatus(uid));
}
