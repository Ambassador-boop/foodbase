import { NextRequest, NextResponse } from 'next/server';
import { getOne, query } from '@/lib/db';
import { requireAdmin, isAdminAuth } from '@/lib/admin-auth';
import { getLiveBalance } from '@/lib/kudisms';
import { getFundingSetupCheck, getFundingTarget, SMS_LOW_BALANCE_THRESHOLD, SMS_MIN_FUNDING, SMS_PENDING_WINDOW_MINUTES } from '@/lib/kudisms-funding';
import { reconcileAdminTransfers, rowsOf } from '@/lib/admin-transfers';

export const dynamic = 'force-dynamic';

type TransferRow = { id: string; amount: unknown; status: string; created_at: string; failure_reason: string | null };

function recentFunding(row: TransferRow) {
  return {
    id: row.id,
    amount: Number(row.amount ?? 0),
    status: String(row.status ?? 'pending').toLowerCase(),
    createdAt: row.created_at,
    failureReason: row.failure_reason ?? null,
  };
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req); if (!isAdminAuth(auth)) return auth;

    // Try to settle anything already in flight before reporting state, so a
    // transfer that finished at the provider is not shown as pending.
    await reconcileAdminTransfers('sms_funding');

    const live = await getLiveBalance();
    const revenue = await getOne('SELECT available_balance FROM admin_revenue LIMIT 1');
    const [funding, setup] = await Promise.all([getFundingTarget(), getFundingSetupCheck()]);

    const recentRaw = await query(
      `SELECT id, amount, status, created_at, failure_reason
         FROM admin_transfers
        WHERE kind = $1
        ORDER BY created_at DESC
        LIMIT 5`,
      ['sms_funding'],
    );
    const recent = rowsOf(recentRaw).map((row) => recentFunding(row as TransferRow));

    const lastSuccess = await getOne(
      `SELECT created_at FROM admin_transfers
        WHERE kind = $1 AND status = 'success'
        ORDER BY COALESCE(processed_at, created_at) DESC
        LIMIT 1`,
      ['sms_funding'],
    );

    const inFlightRaw = await getOne(
      `SELECT id, amount, status, created_at, failure_reason
         FROM admin_transfers
        WHERE kind = $1 AND status IN ('pending', 'otp')
          AND created_at > NOW() - ($2 || ' minutes')::interval
        ORDER BY created_at DESC
        LIMIT 1`,
      ['sms_funding', String(SMS_PENDING_WINDOW_MINUTES)],
    );

    const isLow = live.available && live.balance !== null && live.balance < SMS_LOW_BALANCE_THRESHOLD;

    return NextResponse.json({
      // Live wallet figure. `balance` is null when the lookup failed so no
      // surface can render a failed lookup as ₦0.
      balance: live.balance,
      balanceAvailable: live.available,
      balanceUnavailable: !live.available,
      balanceStale: live.stale,
      balanceUpdatedAt: live.lastUpdated,
      lastKnownBalance: live.lastKnownBalance,

      lowThreshold: SMS_LOW_BALANCE_THRESHOLD,
      isLow,
      minFunding: SMS_MIN_FUNDING,
      vatRate: 0.075,
      pendingWindowMinutes: SMS_PENDING_WINDOW_MINUTES,

      funding,
      setup,
      adminAvailable: Number(revenue?.available_balance ?? 0),
      lastFundedAt: lastSuccess?.created_at ?? null,
      recent,
      inFlight: inFlightRaw ? recentFunding(inFlightRaw as TransferRow) : null,
      generatedAt: new Date().toISOString(),
    });
  } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
