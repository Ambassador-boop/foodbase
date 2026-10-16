import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, isAdminAuth } from '@/lib/admin-auth';
import { getKudiBalance } from '@/lib/pin-utils';

/**
 * GET /api/kudi-sms/balance
 * Returns current KudiSMS account balance
 * Public endpoint (consider adding auth if needed)
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req); if (!isAdminAuth(auth)) return auth;
  try {
    const balance = await getKudiBalance();

    if (!balance) {
      return NextResponse.json(
        {
          balance: null,
          lastUpdated: null,
          message: 'No balance data available yet',
        },
        { status: 200 }
      );
    }

    return NextResponse.json({
      balance: balance.balance,
      lastUpdated: balance.last_updated,
      formattedBalance: `₦${Number(balance.balance).toLocaleString('en-NG', { minimumFractionDigits: 2 })}`,
    });
  } catch (error) {
    console.error('[v0] Failed to fetch KudiSMS balance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch balance' },
      { status: 500 }
    );
  }
}
