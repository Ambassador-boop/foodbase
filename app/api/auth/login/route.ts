import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getOne } from '@/lib/db';
import { verifyPassword, createJWT, setAuthCookie } from '@/lib/auth';
import { ACTIVE_BUSINESS_COOKIE } from '@/lib/active-business';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password required' },
        { status: 400 }
      );
    }

    // Get user from database
    const user = await getOne('SELECT * FROM users WHERE email = $1', [email]);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password
    const passwordMatch = await verifyPassword(password, user.password_hash);

    if (!passwordMatch) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Account is inactive' },
        { status: 403 }
      );
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
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
    }

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
    console.error('[v0] Login error:', error);
    return NextResponse.json(
      { error: 'Login failed' },
      { status: 500 }
    );
  }
}
