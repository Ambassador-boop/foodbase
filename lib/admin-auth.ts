import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyJWT } from '@/lib/auth';

export async function requireAdmin(req: NextRequest): Promise<{ userId: string } | NextResponse> {
  const token = await getTokenFromRequest(req);
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const payload = await verifyJWT(token);
  if (!payload) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (payload.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const userId = String(payload.userId || payload.sub || '');
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return { userId };
}

export function isAdminAuth(value: { userId: string } | NextResponse): value is { userId: string } {
  return !(value instanceof NextResponse);
}
