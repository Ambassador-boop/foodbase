import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { reconcileBusinessWithdrawals } from '@/lib/withdrawals';

/**
 * Frequent withdrawal reconciliation cron — runs every 30 seconds.
 *
 * Sweeps through all businesses with pending or inconclusive withdrawals
 * and syncs their status from Paystack. If any have turned failed, credits
 * the balance back immediately.
 *
 * This ensures the business owner sees their balance corrected quickly
 * without having to navigate to the finance page.
 *
 * Auth: Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. We accept
 * that, plus a manual `?key=<CRON_SECRET>` for one-off testing.
 */

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const key = req.nextUrl.searchParams.get('key') || '';
  const expected = process.env.CRON_SECRET;

  if (expected) {
    const ok = auth === `Bearer ${expected}` || key === expected;
    if (!ok) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  try {
    // Find all businesses with pending, queued, otp, received, or non-reversed
    // failed withdrawals. We prioritize those with recent activity.
    const businessRows: any = await db.query(
      `SELECT DISTINCT b.id
         FROM businesses b
         JOIN withdrawals w ON w.business_id = b.id
        WHERE (
                LOWER(w.status::text) IN ('pending', 'otp', 'received', 'queued')
             OR (LOWER(w.status::text) IN ('failed', 'reversed', 'abandoned', 'blocked', 'rejected')
                 AND w.balance_reversed = false
                 AND w.balance_deducted = true)
              )
          AND w.created_at >= NOW() - INTERVAL '90 days'
        ORDER BY MAX(w.created_at) DESC
        LIMIT 100`,
      [],
    );

    const businesses = Array.isArray(businessRows)
      ? businessRows
      : businessRows?.rows ?? [];

    let totalScanned = 0;
    let totalReversed = 0;
    let totalReversedAmount = 0;

    // Reconcile each business in parallel (or sequentially if desired)
    for (const biz of businesses) {
      try {
        const result = await reconcileBusinessWithdrawals(biz.id);
        totalScanned += result.scanned;
        totalReversed += result.reversed;
        totalReversedAmount += result.reversedAmount;
      } catch (err) {
        console.error(
          '[v0] reconcile-withdrawals: failed for business',
          biz.id,
          err,
        );
      }
    }

    console.log('[v0] reconcile-withdrawals: completed', {
      businesses: businesses.length,
      scanned: totalScanned,
      reversed: totalReversed,
      reversedAmount: totalReversedAmount,
    });

    return NextResponse.json({
      ok: true,
      businesses: businesses.length,
      scanned: totalScanned,
      reversed: totalReversed,
      reversedAmount: totalReversedAmount,
    });
  } catch (err) {
    console.error('[v0] reconcile-withdrawals: fatal error', err);
    return NextResponse.json(
      {
        error: 'Reconciliation failed',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    );
  }
}

export const POST = GET;
