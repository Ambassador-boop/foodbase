import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getActiveBusiness } from '@/lib/active-business';
import { loadKitchenOrderGuard } from '@/lib/kitchen/board';
import { getKitchenSchema } from '@/lib/kitchen/schema';
import {
  KITCHEN_STAGE_STATUS,
  REJECTION_MESSAGES,
  isFinalStatus,
  isKitchenTransition,
  stageForStatus,
} from '@/lib/kitchen/transitions';
import type { KitchenRejectionCode, KitchenStage } from '@/lib/kitchen/types';
import { PATCH as updateOrderStatus } from '@/app/api/orders/[orderId]/status/route';

/**
 * PATCH /api/business/kitchen/orders/[orderId]
 *
 * Body: `{ to: 'preparing' | 'ready', prepMinutes?: 10 | 15 | 20 | 30 }`
 *
 * The kitchen may only:
 *   pending   -> preparing
 *   preparing -> ready
 *   ready     -> preparing   (recall)
 *
 * Everything else is rejected before anything is written: an unpaid order, a
 * completed or cancelled order, an out-for-delivery order, another business's
 * order, and any target that is not `preparing` or `ready`.
 *
 * The write itself is **not** reimplemented here. Once the move is legal this
 * route calls the existing status endpoint's handler in-process
 * (`app/api/orders/[orderId]/status`), forwarding the caller's own auth, so the
 * order is updated and the existing status side effects run exactly as they do
 * for a manual change on the orders page. No notification logic is copied.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_TARGETS: KitchenStage[] = ['preparing', 'ready'];

function reject(code: KitchenRejectionCode, status: number) {
  return NextResponse.json({ error: REJECTION_MESSAGES[code], code }, { status });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  try {
    const business = await getActiveBusiness();
    if (!business) return reject('unauthorized', 401);

    const { orderId } = await params;
    if (!orderId) return reject('not_found', 404);

    const body = await request.json().catch(() => null);
    const to = String((body as { to?: unknown } | null)?.to ?? '').trim().toLowerCase() as KitchenStage;
    const rawPrep = (body as { prepMinutes?: unknown } | null)?.prepMinutes;
    const prepMinutes =
      typeof rawPrep === 'number' && Number.isFinite(rawPrep) && rawPrep > 0 && rawPrep <= 240
        ? Math.round(rawPrep)
        : null;

    if (!ALLOWED_TARGETS.includes(to)) {
      // 'completed', 'out_for_delivery', 'cancelled' and anything else land here.
      return reject('illegal_transition', 409);
    }

    const guard = await loadKitchenOrderGuard(business.id, orderId);
    if (!guard) return reject('not_found', 404);

    const paymentStatus = guard.payment_status.trim().toLowerCase();
    const paid = paymentStatus === 'paid' || paymentStatus === 'completed';
    if (!paid) return reject('unpaid', 409);

    if (isFinalStatus(guard.status)) return reject('final_state', 409);

    const from = stageForStatus(guard.status);
    if (!from) return reject('not_found', 404);
    if (!isKitchenTransition(from, to)) return reject('illegal_transition', 409);

    // Delegate the write and its side effects to the existing status handler.
    const headers = new Headers({ 'content-type': 'application/json' });
    const cookie = request.headers.get('cookie');
    const authorization = request.headers.get('authorization');
    if (cookie) headers.set('cookie', cookie);
    if (authorization) headers.set('authorization', authorization);

    const forwarded = new NextRequest(new URL(request.url), {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: KITCHEN_STAGE_STATUS[to] }),
    });

    const delegated = await updateOrderStatus(forwarded, { params: Promise.resolve({ orderId }) });
    if (!delegated.ok) {
      const detail = await delegated.json().catch(() => ({} as Record<string, unknown>));
      const message =
        typeof (detail as { error?: unknown }).error === 'string'
          ? String((detail as { error: string }).error)
          : 'The order could not be updated. Refresh the board and try again.';
      const status = delegated.status === 401 || delegated.status === 403 ? 403 : delegated.status === 404 ? 404 : 409;
      return NextResponse.json({ error: message, code: 'unauthorized' }, { status });
    }

    // Batch 3C bookkeeping that the status endpoint does not know about. It is
    // additive and optional: without the columns the transition still stands.
    try {
      const schema = await getKitchenSchema();
      const assignments: string[] = [];
      const values: unknown[] = [];
      if (schema.prepMinutes && prepMinutes !== null && to === 'preparing') {
        values.push(prepMinutes);
        assignments.push(`kitchen_prep_minutes = $${values.length}`);
      }
      if (schema.readyAt && to === 'ready') {
        assignments.push('kitchen_ready_at = NOW()');
      }
      if (assignments.length > 0) {
        values.push(orderId, business.id);
        await query(
          `UPDATE orders SET ${assignments.join(', ')}
            WHERE id = $${values.length - 1} AND business_id = $${values.length}`,
          values,
        );
      }
    } catch (error) {
      console.warn('[kitchen] optional bookkeeping skipped', error);
    }

    const changedAt = new Date().toISOString();
    return NextResponse.json({
      success: true,
      orderId,
      stage: to,
      status: KITCHEN_STAGE_STATUS[to],
      changedAt,
    });
  } catch (error) {
    console.error('[kitchen] transition failed', error);
    return NextResponse.json(
      { error: 'The order could not be moved. Refresh the board and try again.', code: 'illegal_transition' },
      { status: 500 },
    );
  }
}
