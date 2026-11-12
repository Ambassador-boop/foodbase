import { NextRequest, NextResponse } from 'next/server';
import { searchNigeriaAddress, mapboxConfigured } from '@/lib/mapbox/server';
import { isValidLatLng } from '@/lib/delivery/geo';

/**
 * GET /api/delivery/search?q=...&lat=..&lng=..
 *
 * Address search for checkout and for the delivery editor, proxied so the
 * country restriction (`country=ng`) cannot be dropped by a client, and so the
 * same six results are cached by the platform between customers.
 *
 * When the token is missing this answers `configured: false` with an empty list
 * and the UI hides the search box instead of showing an empty dropdown.
 */

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!mapboxConfigured()) {
    return NextResponse.json({ configured: false, results: [] });
  }

  const query = request.nextUrl.searchParams.get('q') ?? '';
  if (query.trim().length < 3) {
    return NextResponse.json({ configured: true, results: [] });
  }

  const lat = Number(request.nextUrl.searchParams.get('lat'));
  const lng = Number(request.nextUrl.searchParams.get('lng'));
  const proximity = isValidLatLng({ lat, lng }) ? { lat, lng } : null;

  try {
    const results = await searchNigeriaAddress(query, { proximity, limit: 6 });
    return NextResponse.json({ configured: true, results });
  } catch (error) {
    console.error('[delivery/search] failed', error);
    return NextResponse.json({ configured: true, results: [], error: 'Search is unavailable right now.' });
  }
}
