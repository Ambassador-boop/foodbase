import { NextRequest, NextResponse } from 'next/server';
import { getAuthCookie, verifyJWT } from '@/lib/auth';
import { reconcileBusinessWithdrawals } from '@/lib/withdrawals';

export async function POST(req: NextRequest) {
  try {
    // Get authenticated business
    const token = await getAuthCookie();
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload || payload.role !== 'business_owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const businessId = payload.businessId as string;
    if (!businessId) {
      return NextResponse.json({ error: 'No business ID found' }, { status: 400 });
    }

    // Reconcile withdrawals for this business
    const result = await reconcileBusinessWithdrawals(businessId);

    return NextResponse.json({
      success: true,
      reconciled: result.reconciled,
      reversed: result.reversed,
      totalReversed: result.totalReversed,
    });
  } catch (error) {
    console.error('[v0] Withdrawal reconciliation error:', error);
    return NextResponse.json(
      { error: 'Failed to reconcile withdrawals' },
      { status: 500 }
    );
  }
}
