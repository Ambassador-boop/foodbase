import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { db } from '@/lib/db';
import { getActiveBusinessForUser } from '@/lib/active-business';
import { FREE_WITHDRAWALS_PER_MONTH, OVERAGE_FEE_NGN, MIN_WITHDRAWAL_NGN } from '@/lib/withdrawal-policy';
import { watMonthStartUtc, nextWatMonthStartUtc } from '@/lib/wat';
function rowsOf(raw: any): any[] { return Array.isArray(raw) ? raw : raw?.rows ?? []; }
export async function GET(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || req.cookies.get('auth_token')?.value;
  const payload = token ? await verifyJWT(token) : null; const userId = payload && ((payload as any).userId || (payload as any).id);
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const business = await getActiveBusinessForUser(userId); if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  const raw: any = await db.query(`SELECT COUNT(*)::int AS count FROM withdrawals WHERE business_id=$1 AND created_at >= $2 AND LOWER(status::text) NOT IN ('failed','rejected','abandoned','blocked','reversed')`, [business.id, watMonthStartUtc().toISOString()]);
  const usedThisMonth = Number(rowsOf(raw)[0]?.count || 0);
  return NextResponse.json({ freeLimit: FREE_WITHDRAWALS_PER_MONTH, overageFee: OVERAGE_FEE_NGN, minAmount: MIN_WITHDRAWAL_NGN, usedThisMonth, remainingFree: Math.max(0, FREE_WITHDRAWALS_PER_MONTH - usedThisMonth), nextWithdrawalHasFee: usedThisMonth >= FREE_WITHDRAWALS_PER_MONTH, resetsAt: nextWatMonthStartUtc().toISOString(), availableBalance: Number(business.available_balance || 0), pendingBalance: Number(business.pending_balance || 0) });
}
