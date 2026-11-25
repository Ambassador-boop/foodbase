import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyJWT } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAndSendRefund } from '@/lib/refunds';
import { getActiveBusinessForUser } from '@/lib/active-business';
import { normalizeAmount, requireTicket } from '@/lib/security/pin';
import { parseParams, parseBody, fail } from '@/lib/api';
import { handleUnexpected } from '@/lib/api/handler';
import { RATE_LIMITS, enforceRateLimit } from '@/lib/rate-limit';

const RefundIdParam = z.object({
  refundId: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/, 'That refund reference is not valid.'),
});

/** A retry carries only the authorisation ticket; the amount comes from the row. */
const RetryBody = z.object({
  authorizationTicket: z.string().max(200).optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ refundId: string }> }) {
  try {
    const token = request.cookies.get('auth_token')?.value || request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return fail('UNAUTHORIZED', 'Unauthorized', 401);
    const user = await verifyJWT(token);
    if (!user) return fail('UNAUTHORIZED', 'Invalid auth token', 401);
    const userId = (user as any).userId || (user as any).id;

    const parsedParams = parseParams(await params, RefundIdParam);
    if (!parsedParams.ok) return parsedParams.response;
    const { refundId } = parsedParams.data;

    const parsedBody = await parseBody(request, RetryBody, 'Check the request and try again.');
    if (!parsedBody.ok) return parsedBody.response;
    const body = parsedBody.data;

    const limited = await enforceRateLimit(request, RATE_LIMITS.refundUser, { userId: String(userId) });
    if (limited) return limited;
    const raw: any = await db.query(`SELECT r.id,r.order_id,r.refund_amount,r.amount,r.status,r.reason,r.notes FROM refunds r JOIN orders o ON o.id=r.order_id JOIN businesses b ON b.id=o.business_id WHERE r.id=$1 AND b.owner_id=$2`, [refundId, userId]);
    const refund = (Array.isArray(raw) ? raw : raw?.rows ?? [])[0];
    if (!refund) return fail('REFUND_NOT_FOUND', 'Refund not found or not authorized', 404);
    if (String(refund.status).toLowerCase() !== 'failed') return fail('REFUND_NOT_FAILED', 'Can only retry failed refunds', 400);
    const business = await getActiveBusinessForUser(userId); if (!business) return fail('BUSINESS_NOT_FOUND', 'Business not found', 404);
    const retryAmount = Number(refund.refund_amount ?? refund.amount);
    const authorized = await requireTicket({ ticket: body.authorizationTicket, userId, businessId: business.id, action: 'refund', bind: { order_id: String(refund.order_id), amount: normalizeAmount(retryAmount) } });
    if (!authorized) return fail('PIN_REQUIRED', 'PIN authorization required', 403);
    await db.query('SELECT fb_reverse_failed_refund($1)', [refundId]);
    const result = await createAndSendRefund({ orderId: refund.order_id, ownerId: userId, amount: Number(refund.refund_amount ?? refund.amount), reason: refund.reason, notes: refund.notes });
    return NextResponse.json({ success: result.statusCode < 300, refundId: result.response.refundId, status: result.response.status, ...(result.response.error ? { error: result.response.error } : {}) }, { status: result.statusCode });
  } catch (error) {
    return handleUnexpected(error, { where: 'POST /api/refunds/[refundId]/retry', request });
  }
}
