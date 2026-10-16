import { NextRequest, NextResponse } from 'next/server';
import { getOne, query } from '@/lib/db';
import { requireAdmin, isAdminAuth } from '@/lib/admin-auth';
import { getLiveBalance } from '@/lib/kudisms';
import { getFundingTarget } from '@/lib/kudisms-funding';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req); if (!isAdminAuth(auth)) return auth;
    const live = await getLiveBalance();
    const revenue = await getOne('SELECT available_balance FROM admin_revenue LIMIT 1');
    const recent = await query('SELECT id, amount, status, created_at, failure_reason FROM admin_transfers WHERE kind=$1 ORDER BY created_at DESC LIMIT 20', ['sms_funding']);
    return NextResponse.json({ ...live, lowThreshold: 100, isLow: live.balance < 100, minFunding: 1000, funding: await getFundingTarget(), adminAvailable: Number(revenue?.available_balance ?? 0), recent: recent.rows ?? recent });
  } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
