import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { getActiveBusinessForUser } from '@/lib/active-business';
import { reconcileBusinessWithdrawals } from '@/lib/withdrawals';

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    let token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      token = req.cookies.get('auth_token')?.value;
    }

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = (payload as any).userId || (payload as any).id;
    
    // Get the active business for this user
    const business = await getActiveBusinessForUser(userId);
    if (!business) {
      return NextResponse.json({ error: 'No active business' }, { status: 400 });
    }

    console.log('[v0] POST /business/reconcile-withdrawals: Starting reconciliation for business:', business.id);

    // Reconcile all withdrawals for this business
    // This will check for pending/queued withdrawals that have now turned failed
    // and reverse their balance if needed
    const result = await reconcileBusinessWithdrawals(business.id);

    console.log('[v0] POST /business/reconcile-withdrawals: Completed. Scanned:', result.scanned, 'Reversed:', result.reversed, 'Amount:', result.reversedAmount);

    return NextResponse.json({
      success: true,
      scanned: result.scanned,
      reversed: result.reversed,
      reversedAmount: result.reversedAmount,
    });
  } catch (error) {
    console.error('[v0] Withdrawal reconciliation error:', error);
    return NextResponse.json(
      { error: 'Failed to reconcile withdrawals' },
      { status: 500 }
    );
  }
}

/**
 * GET is also supported for testing/manual triggers
 */
export async function GET(req: NextRequest) {
  return POST(req);
}
