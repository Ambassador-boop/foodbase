import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getOne } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ACTIVE_BUSINESS_COOKIE } from '@/lib/active-business';

/**
 * Switches the active business for the current user. The active business is
 * persisted in an HTTP-only cookie so every server route (menu, addons,
 * drinks, categories, popular dishes, dashboard, finance, etc.) sees the
 * same value. The client also reflects the change because the layout reads
 * the businesses list and `currentBusinessId` from localStorage in sync.
 */
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const businessId =
      body?.business_id || body?.businessId || body?.id || null;

    if (!businessId) {
      return NextResponse.json(
        { error: 'business_id is required' },
        { status: 400 },
      );
    }

    // Verify the user actually owns this business before trusting the value.
    const business = await getOne(
      `SELECT id, name, slug, logo_url
         FROM businesses
        WHERE id = $1 AND owner_id = $2`,
      [businessId, currentUser.id],
    );

    if (!business) {
      return NextResponse.json(
        { error: 'Business not found or unauthorized' },
        { status: 404 },
      );
    }

    const cookieStore = await cookies();
    cookieStore.set(ACTIVE_BUSINESS_COOKIE, business.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });

    return NextResponse.json({
      success: true,
      message: 'Business switched successfully',
      business,
    });
  } catch (error) {
    console.error('[v0] Switch business error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

/**
 * Returns the currently active business id for the user. Useful for the
 * client to stay in sync with the server-side cookie after navigation.
 */
export async function GET() {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cookieStore = await cookies();
    const cookieBusinessId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;

    if (cookieBusinessId) {
      const business = await getOne(
        `SELECT id, name, slug, logo_url
           FROM businesses
          WHERE id = $1 AND owner_id = $2`,
        [cookieBusinessId, currentUser.id],
      );
      if (business) {
        return NextResponse.json({ business });
      }
    }

    // Fallback to the oldest business if cookie is missing or stale.
    const fallback = await getOne(
      `SELECT id, name, slug, logo_url
         FROM businesses
        WHERE owner_id = $1
        ORDER BY created_at ASC
        LIMIT 1`,
      [currentUser.id],
    );

    return NextResponse.json({ business: fallback });
  } catch (error) {
    console.error('[v0] Get active business error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
