import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyJWT } from '@/lib/auth';
import { createAndSendRefund } from '@/lib/refunds';
import { getActiveBusinessForUser } from '@/lib/active-business';
import { normalizeAmount, requireTicket } from '@/lib/security/pin';
import { parseBody, fail } from '@/lib/api';
import { handleUnexpected } from '@/lib/api/handler';
import { RATE_LIMITS, enforceRateLimit } from '@/lib/rate-limit';

const RefundRequestBody = z.object({
  orderId: z.string().trim().min(1, 'Order ID is required').max(100),
  amount: z
    .number({ invalid_type_error: 'Enter the amount to refund' })
    .finite('Enter the amount to refund')
    .positive('Amount must be a positive number with at most two decimal places')
    .refine((value) => Math.round(value * 100) === value * 100, {
      message: 'Amount must be a positive number with at most two decimal places',
    }),
  reason: z
    .string()
    .trim()
    .min(1, 'Reason is required and must be 200 characters or fewer')
    .max(200, 'Reason is required and must be 200 characters or fewer'),
  notes: z.string().max(500, 'Notes must be 500 characters or fewer').nullish(),
  authorizationTicket: z.string().max(200).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value;
    if (!token) return fail('UNAUTHORIZED', 'Unauthorized', 401);
    const payload = await verifyJWT(token);
    if (!payload) return fail('UNAUTHORIZED', 'Invalid token', 401);
    const ownerId = (payload as any).userId || (payload as any).id;

    const parsed = await parseBody(request, RefundRequestBody, 'Check the refund details.');
    if (!parsed.ok) return parsed.response;
    const { orderId, amount, reason, notes, authorizationTicket } = parsed.data;

    // 10 refund requests an hour per owner: a refund is money leaving.
    const limited = await enforceRateLimit(request, RATE_LIMITS.refundUser, { userId: String(ownerId) });
    if (limited) return limited;

    const business = await getActiveBusinessForUser(ownerId);
    if (!business) return fail('BUSINESS_NOT_FOUND', 'Business not found', 404);

    const authorized = await requireTicket({ ticket: authorizationTicket, userId: ownerId, businessId: business.id, action: 'refund', bind: { order_id: orderId, amount: normalizeAmount(amount) } });
    if (!authorized) return fail('PIN_REQUIRED', 'PIN authorization required', 403);

    const result = await createAndSendRefund({ orderId, ownerId, amount, reason, notes: notes ?? undefined });
    return NextResponse.json(result.response, { status: result.statusCode });
  } catch (error) {
    return handleUnexpected(error, { where: 'POST /api/refunds/request', request });
  }
}
