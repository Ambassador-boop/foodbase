import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { getOne } from '@/lib/db';
import { verifyPassword, createJWT, setAuthCookie } from '@/lib/auth';
import { ACTIVE_BUSINESS_COOKIE } from '@/lib/active-business';
import { env } from '@/lib/env';
import { parseBody, fail } from '@/lib/api';
import { handleUnexpected } from '@/lib/api/handler';
import { RATE_LIMITS, enforceRateLimit } from '@/lib/rate-limit';

/** The body this route accepts. Anything else is a 422 before a query runs. */
const LoginBody = z.object({
  email: z.string().trim().min(1, 'Enter your email address').max(320).email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password').max(200),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseBody(request, LoginBody, 'Enter your email address and password.');
    if (!parsed.ok) return parsed.response;
    const { email, password } = parsed.data;

    // Two windows, as specified: one per connection, one per account. Both are
    // counted in Postgres so they hold across serverless instances.
    const limitedByIp = await enforceRateLimit(request, RATE_LIMITS.signInIp);
    if (limitedByIp) return limitedByIp;
    const limitedByEmail = await enforceRateLimit(request, RATE_LIMITS.signInEmail, { identifier: email });
    if (limitedByEmail) return limitedByEmail;

    // Get user from database
    const user = await getOne('SELECT * FROM users WHERE email = $1', [email]);

    if (!user) {
      return fail('INVALID_CREDENTIALS', 'Invalid credentials', 401);
    }

    // Verify password
    const passwordMatch = await verifyPassword(password, user.password_hash);

    if (!passwordMatch) {
      return fail('INVALID_CREDENTIALS', 'Invalid credentials', 401);
    }

    // Check if user is active
    if (!user.is_active) {
      return fail('ACCOUNT_INACTIVE', 'Account is inactive', 403);
    }

    // Get business if business owner
    let businessId: string | undefined;
    if (user.role === 'business_owner') {
      const business = await getOne(
        'SELECT id FROM businesses WHERE owner_id = $1',
        [user.id]
      );
      businessId = business?.id;
    }

    // Create JWT token
    const token = await createJWT({
      userId: user.id,
      role: user.role,
      businessId,
    });

    // Set authentication cookie
    await setAuthCookie(token);

    // Set the active business cookie for business owners
    if (user.role === 'business_owner' && businessId) {
      const cookieStore = await cookies();
      cookieStore.set(ACTIVE_BUSINESS_COOKIE, businessId, {
        httpOnly: true,
        secure: env.isProduction,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
    }

    // Log successful login (identifiers only, never the password)
    console.log('[v0] User logged in:', {
      userId: user.id,
      email: user.email,
      role: user.role,
      businessId,
    });

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: `${user.first_name} ${user.last_name}`,
        businessId,
      },
      redirectUrl:
        user.role === 'admin'
          ? '/admin'
          : `/dashboard`,
    });
  } catch (error) {
    return handleUnexpected(error, { where: 'POST /api/auth/login', request });
  }
}
