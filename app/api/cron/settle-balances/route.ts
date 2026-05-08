import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateAlphanumericId } from '@/lib/utils';
import { reconcileBusinessWithdrawals } from '@/lib/withdrawals';

/**
 * Daily settlement cron — runs at 04:00 UTC == 05:00 WAT.
 *
 * Moves every transaction whose:
 *   settlement_status = 'pending'
 *   balance_bucket    = 'pending'
 *   available_at     <= NOW()
 *
 * out of businesses.pending_balance and into businesses.available_balance,
 * marks the transaction settled, and writes a 'settlement' finance_records
 * row so the dashboard /finance page reflects the move.
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
    // Pull every due pending transaction.
    const due: any = await db.query(
      `SELECT id, business_id, order_id, amount, payment_reference, available_at
         FROM transactions
        WHERE settlement_status = 'pending'
          AND balance_bucket = 'pending'
          AND available_at IS NOT NULL
          AND available_at <= NOW()
        ORDER BY available_at ASC
        LIMIT 1000`,
      [],
    );
    const dueRows = Array.isArray(due) ? due : due?.rows ?? [];

    if (dueRows.length === 0) {
      return NextResponse.json({ ok: true, settled: 0 });
    }

    // For each transaction, calculate the net amount after refunds
    const transactionAdjustments = new Map<string, { netAmount: number; refundedAmount: number }>();
    
    for (const txn of dueRows) {
      // Query total refunded amount for this transaction (exclude failed/rejected refunds)
      const refundResult: any = await db.query(
        `SELECT COALESCE(SUM(refund_amount), 0) as total_refunded
           FROM refunds
          WHERE transaction_id = $1
            AND status NOT IN ('failed', 'rejected')`,
        [txn.id],
      );
      
      const refundRow = Array.isArray(refundResult) ? refundResult[0] : refundResult?.rows?.[0];
      const refundedAmount = Number(refundRow?.total_refunded || 0);
      const originalAmount = Number(txn.amount) || 0;
      const netAmount = originalAmount - refundedAmount;
      
      transactionAdjustments.set(txn.id, {
        netAmount: Math.max(0, netAmount),
        refundedAmount,
      });
    }

    // Aggregate per business so we do one balance update per business,
    // accounting for refunds
    const perBusiness = new Map<string, number>();
    for (const r of dueRows) {
      const bid = r.business_id as string;
      const adjustment = transactionAdjustments.get(r.id)!;
      const netAmount = adjustment.netAmount;
      perBusiness.set(bid, (perBusiness.get(bid) || 0) + netAmount);
    }

    let settledCount = 0;
    let fullyRefundedCount = 0;

    for (const [businessId, total] of perBusiness.entries()) {
      try {
        // Move money: pending -> available (only net amounts after refunds)
        await db.query(
          `UPDATE businesses
              SET pending_balance   = GREATEST(0, COALESCE(pending_balance, 0) - $1),
                  available_balance = COALESCE(available_balance, 0) + $1,
                  updated_at = NOW()
            WHERE id = $2`,
          [total, businessId],
        );
      } catch (err) {
        console.error('[v0] settle-balances: balance update failed for', businessId, err);
        continue;
      }

      // Per-row updates + finance_records
      for (const r of dueRows.filter((x: any) => x.business_id === businessId)) {
        try {
          const adjustment = transactionAdjustments.get(r.id)!;
          const netAmount = adjustment.netAmount;
          const refundedAmount = adjustment.refundedAmount;
          const isFullyRefunded = netAmount <= 0;

          await db.query(
            `UPDATE transactions
                SET settlement_status = 'settled',
                    balance_bucket = 'available',
                    settled_at = NOW()
              WHERE id = $1`,
            [r.id],
          );

          // Only create finance record if there's a net amount to settle
          if (netAmount > 0) {
            let description = 'Pending balance settled into available balance';
            if (refundedAmount > 0) {
              description += ` (refunded: ${refundedAmount})`;
            }

            await db.query(
              `INSERT INTO finance_records
                 (id, business_id, record_type, bucket, direction, amount,
                  related_id, reference, description, created_at)
               VALUES ($1, $2, 'settlement', 'available', 'in', $3, $4, $5, $6, NOW())`,
              [
                `fr_${generateAlphanumericId()}`,
                businessId,
                netAmount,
                r.order_id || r.id,
                r.payment_reference || null,
                description,
              ],
            );

            settledCount++;
          } else {
            // Fully refunded transaction - still mark as settled but don't move funds
            fullyRefundedCount++;
            
            // Record this as a fully refunded settlement for audit purposes
            await db.query(
              `INSERT INTO finance_records
                 (id, business_id, record_type, bucket, direction, amount,
                  related_id, reference, description, created_at)
               VALUES ($1, $2, 'settlement', 'pending', 'none', 0, $3, $4, $5, NOW())`,
              [
                `fr_${generateAlphanumericId()}`,
                businessId,
                r.order_id || r.id,
                r.payment_reference || null,
                'Transaction fully refunded - no settlement',
              ],
            );
          }
        } catch (err) {
          console.error('[v0] settle-balances: per-row settle failed for', r.id, err);
        }
      }
    }

    // ---------------------------------------------------------------
    // Phase 2: sweep every business that had activity recently and
    // reconcile any pending or terminally-failed withdrawals so failed
    // transfers credit back to available_balance even if no one
    // visited /dashboard/finance today.
    // ---------------------------------------------------------------
    const activeBizRows: any = await db.query(
      `SELECT DISTINCT b.id
         FROM businesses b
         JOIN withdrawals w ON w.business_id = b.id
        WHERE w.created_at >= NOW() - INTERVAL '60 days'
           OR (w.balance_reversed = false
               AND LOWER(w.status::text) IN
                   ('failed','reversed','abandoned','blocked','rejected',
                    'pending','otp','received','queued'))`,
      [],
    );
    const activeBiz = Array.isArray(activeBizRows)
      ? activeBizRows
      : activeBizRows?.rows ?? [];
    let withdrawalsReversed = 0;
    let withdrawalsReversedAmount = 0;
    for (const biz of activeBiz) {
      try {
        const r = await reconcileBusinessWithdrawals(biz.id);
        withdrawalsReversed += r.reversed;
        withdrawalsReversedAmount += r.reversedAmount;
      } catch (err) {
        console.error(
          '[v0] settle-balances: withdrawal reconcile failed for',
          biz.id,
          err,
        );
      }
    }

    console.log('[v0] settle-balances: completed', {
      settledCount,
      fullyRefundedCount,
      businesses: perBusiness.size,
      withdrawalsReversed,
      withdrawalsReversedAmount,
    });

    return NextResponse.json({
      ok: true,
      settled: settledCount,
      fullyRefundedCount,
      businesses: perBusiness.size,
      withdrawalsReversed,
      withdrawalsReversedAmount,
    });
  } catch (err) {
    console.error('[v0] settle-balances: fatal error', err);
    return NextResponse.json(
      { error: 'Settlement failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const POST = GET;
