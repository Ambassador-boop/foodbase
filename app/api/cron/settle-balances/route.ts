import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { db } from '@/lib/db';
import { reconcileBusinessWithdrawals } from '@/lib/withdrawals';

export const dynamic = 'force-dynamic';

function authorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return 'missing';
  const actual = Buffer.from(req.headers.get('authorization') || '');
  const expected = Buffer.from(`Bearer ${secret}`);
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected) ? 'ok' : 'invalid';
}

async function run(req: NextRequest) {
  const auth = authorized(req);
  if (auth === 'missing') return NextResponse.json({ error: 'Cron is not configured' }, { status: 500 });
  if (auth !== 'ok') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const heartbeat = process.env.BETTERSTACK_HEARTBEAT_URL;
  try {
    let settled = 0;
    let fullyRefundedCount = 0;
    for (let i = 0; i < 20; i++) {
      const raw: any = await db.query('SELECT fb_settle_due_transactions($1) AS result', [500]);
      const row = Array.isArray(raw) ? raw[0] : raw?.rows?.[0];
      const result = typeof row?.result === 'string' ? JSON.parse(row.result) : row?.result || {};
      settled += Number(result.settled || 0);
      fullyRefundedCount += Number(result.fully_refunded || 0);
      if (Number(result.settled || 0) === 0 && Number(result.fully_refunded || 0) === 0) break;
    }
    const activeRaw: any = await db.query(`SELECT DISTINCT b.id FROM businesses b JOIN withdrawals w ON w.business_id=b.id WHERE w.created_at >= NOW()-INTERVAL '60 days' OR (w.balance_reversed=false AND LOWER(w.status::text) IN ('failed','reversed','abandoned','blocked','rejected','pending','otp','received','queued'))`, []);
    const active = Array.isArray(activeRaw) ? activeRaw : activeRaw?.rows ?? [];
    let withdrawalsReversed = 0;
    let withdrawalsReversedAmount = 0;
    for (const business of active) {
      const result = await reconcileBusinessWithdrawals(business.id);
      withdrawalsReversed += result.reversed;
      withdrawalsReversedAmount += result.reversedAmount;
    }
    if (heartbeat) await fetch(heartbeat, { cache: 'no-store' }).catch(() => {});
    return NextResponse.json({ ok: true, settled, fullyRefundedCount, withdrawalsReversed, withdrawalsReversedAmount });
  } catch (error) {
    if (heartbeat) await fetch(`${heartbeat}/fail`, { method: 'POST', cache: 'no-store' }).catch(() => {});
    console.error('[v0] settle-balances failed:', error);
    return NextResponse.json({ error: 'Settlement failed' }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
