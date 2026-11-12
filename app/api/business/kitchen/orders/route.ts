import { NextRequest, NextResponse } from 'next/server';
import { getActiveBusiness } from '@/lib/active-business';
import { loadKitchenBoard, loadKitchenSignature } from '@/lib/kitchen/board';

/**
 * GET /api/business/kitchen/orders
 *
 * The kitchen board: every paid order the pass still has to deal with, with its
 * lines, add-ons and the two counters above the columns.
 *
 * Cheap polling:
 *   - `If-None-Match: "<signature>"` (what the browser sends by itself when it
 *     has the previous ETag) or `?since=<signature>` answers **304 No Content**
 *     after a single aggregate query, with no ticket data at all.
 *   - The signature is derived from the board itself (row count plus the newest
 *     `updated_at`), so any start, ready or recall changes it.
 *
 * The response is never cached by a proxy or the browser: the kitchen board must
 * not serve a stored copy.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = {
  'Cache-Control': 'no-store, max-age=0, must-revalidate',
} as const;

export async function GET(request: NextRequest) {
  try {
    const business = await getActiveBusiness();
    if (!business) {
      return NextResponse.json(
        { error: 'Sign in with a restaurant account to open the kitchen display.' },
        { status: 401, headers: NO_STORE },
      );
    }

    const signature = await loadKitchenSignature(business.id);
    const etag = `"${signature}"`;
    const ifNoneMatch = request.headers.get('if-none-match');
    const since = request.nextUrl.searchParams.get('since');

    const matchesEtag =
      typeof ifNoneMatch === 'string' &&
      ifNoneMatch
        .split(',')
        .map((value) => value.trim())
        .some((value) => value === etag || value === `W/${etag}`);
    const matchesSince = Boolean(since) && since === signature;

    if (matchesEtag || matchesSince) {
      return new NextResponse(null, {
        status: 304,
        headers: { ...NO_STORE, ETag: etag },
      });
    }

    const payload = await loadKitchenBoard({ id: business.id, name: business.name });
    return NextResponse.json(payload, {
      headers: { ...NO_STORE, ETag: `"${payload.etag}"` },
    });
  } catch (error) {
    console.error('[kitchen] board read failed', error);
    return NextResponse.json(
      { error: 'The kitchen board could not be loaded. It will retry automatically.' },
      { status: 500, headers: NO_STORE },
    );
  }
}
