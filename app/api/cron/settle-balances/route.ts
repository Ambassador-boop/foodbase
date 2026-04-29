import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateAlphanumericId } from '@/lib/utils';

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

    // Aggregate per business so we do one balance update per business.
    const perBusiness = new Map<string, number>();
    for (const r of dueRows) {
      const bid = r.business_id as string;
      const amt = Number(r.amount) || 0;
      perBusiness.set(bid, (perBusiness.get(bid) || 0) + amt);
    }

    let settledCount = 0;

    for (const [businessId, total] of perBusiness.entries()) {
      try {
        // Move money: pending -> available
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
          await db.query(
            `UPDATE transactions
                SET settlement_status = 'settled',
                    balance_bucket = 'available',
                    settled_at = NOW()
              WHERE id = $1`,
            [r.id],
          );

          await db.query(
            `INSERT INTO finance_records
               (id, business_id, record_type, bucket, direction, amount,
                related_id, reference, description, created_at)
             VALUES ($1, $2, 'settlement', 'available', 'in', $3, $4, $5,
                     'Pending balance settled into available balance', NOW())`,
            [
              `fr_${generateAlphanumericId()}`,
              businessId,
              Number(r.amount) || 0,
              r.order_id || r.id,
              r.payment_reference || null,
            ],
          );

          settledCount++;
        } catch (err) {
          console.error('[v0] settle-balances: per-row settle failed for', r.id, err);
        }
      }
    }

    console.log('[v0] settle-balances: completed', {
      settledCount,
      businesses: perBusiness.size,
    });

    return NextResponse.json({
      ok: true,
      settled: settledCount,
      businesses: perBusiness.size,
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
