import { NextRequest, NextResponse } from 'next/server';
import { getOne, query } from '@/lib/db';
import { requireAdmin, isAdminAuth } from '@/lib/admin-auth';
import { getLiveBalance } from '@/lib/kudisms';
import { getFundingSetupCheck, getFundingTarget, SMS_LOW_BALANCE_THRESHOLD, SMS_MIN_FUNDING, SMS_PENDING_WINDOW_MINUTES } from '@/lib/kudisms-funding';
import { reconcileAdminTransfers, rowsOf } from '@/lib/admin-transfers';

export const dynamic = 'force-dynamic';

type TransferRow = {
  id: string;
  amount: unknown;
  status: string;
  created_at: string;
  failure_reason: string | null;
  provider_fee?: unknown;
};

function recentFunding(row: TransferRow) {
  const amount = Number(row.amount ?? 0);
  const providerFee = Number(row.provider_fee ?? 0) || 0;
  return {
    id: row.id,
    amount,
    status: String(row.status ?? 'pending').toLowerCase(),
    createdAt: row.created_at,
    failureReason: row.failure_reason ?? null,
    // Paystack's transfer fee + stamp duty, recorded when the transfer succeeded.
    providerFee,
    totalCost: Math.round((amount + providerFee) * 100) / 100,
  };
}

const RECENT_FUNDING_COLUMNS = 'id, amount, status, created_at, failure_reason';

/**
 * The recent fundings, with the provider fee when the column is there. A database
 * that has not had docs/sql/2d-transfer-fee.sql applied yet still renders the panel;
 * it just shows no fee.
 */
async function recentFundings(limit = 5): Promise<TransferRow[]> {
  try {
    return rowsOf(
      await query(
        `SELECT ${RECENT_FUNDING_COLUMNS}, provider_fee
           FROM admin_transfers
          WHERE kind = $1
          ORDER BY created_at DESC
          LIMIT ${Number(limit)}`,
        ['sms_funding'],
      ),
    ) as TransferRow[];
  } catch (error) {
    console.error('[admin/sms] provider_fee unavailable; recent fundings show no fee', error);
    return rowsOf(
      await query(
        `SELECT ${RECENT_FUNDING_COLUMNS}
           FROM admin_transfers
          WHERE kind = $1
          ORDER BY created_at DESC
          LIMIT ${Number(limit)}`,
        ['sms_funding'],
      ),
    ) as TransferRow[];
  }
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

    const recent = (await recentFundings(5)).map((row) => recentFunding(row));

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
