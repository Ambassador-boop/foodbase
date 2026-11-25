import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyJWT, verifyPassword, hashPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { requireTicket } from '@/lib/security/pin';
import { parseBody, fail } from '@/lib/api';
import { handleUnexpected } from '@/lib/api/handler';

function getUserId(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') || req.cookies.get('auth_token')?.value;
  return token ? verifyJWT(token).then((p) => p ? String((p as any).userId || (p as any).id) : null) : Promise.resolve(null);
}
function rowsOf(raw: any): any[] { return Array.isArray(raw) ? raw : raw?.rows ?? []; }

const ChangePasswordBody = z.object({
  currentPassword: z.string().min(1, 'Current password is incorrect').max(200),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(200),
  confirmPassword: z.string().min(1, 'Passwords do not match').max(200),
  authorizationTicket: z.string().max(200).optional(),
});

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req); if (!userId) return fail('UNAUTHORIZED', 'Unauthorized', 401);

    // Existing budget: 5 attempts per 15 minutes per user, straight from the
    // database limiter. Left exactly as it was.
    const rate = await db.query("SELECT fb_rate_limit('pwchange:' || $1, 5, 900) AS allowed", [userId]);
    if (!Boolean(rowsOf(rate)[0]?.allowed)) {
      const response = fail('RATE_LIMITED', 'Too many requests', 429);
      response.headers.set('Retry-After', '900');
      return response;
    }

    const parsed = await parseBody(req, ChangePasswordBody, 'Check the password fields.');
    if (!parsed.ok) return parsed.response;
    const { currentPassword, newPassword, confirmPassword, authorizationTicket } = parsed.data;

    if (newPassword !== confirmPassword) return fail('PASSWORDS_DO_NOT_MATCH', 'Passwords do not match', 400);

    const user = rowsOf(await db.query('SELECT password_hash FROM users WHERE id=$1', [userId]))[0];
    if (!user || !(await verifyPassword(currentPassword, user.password_hash))) return fail('WRONG_PASSWORD', 'Current password is incorrect', 401);
    if (newPassword === currentPassword) return fail('PASSWORD_UNCHANGED', 'New password must be different', 400);

    const business = rowsOf(await db.query('SELECT id FROM businesses WHERE owner_id=$1 AND is_active=true ORDER BY created_at ASC LIMIT 1', [userId]))[0];
    if (!business) return fail('BUSINESS_NOT_FOUND', 'Business not found', 404);
    if (!await requireTicket({ ticket: authorizationTicket, userId, businessId: business.id, action: 'password_change', bind: {} })) return fail('PIN_REQUIRED', 'PIN authorization required', 403);

    const hash = await hashPassword(newPassword);
    await db.query('UPDATE users SET password_hash=$1, updated_at=NOW() WHERE id=$2', [hash, userId]);
    return NextResponse.json({ success: true });
  } catch (error) { return handleUnexpected(error, { where: 'POST /api/user/password/change', request: req }); }
}
