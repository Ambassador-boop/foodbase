import { NextRequest, NextResponse } from 'next/server';
import { getActiveBusiness } from '@/lib/active-business';
import { fetchIsochrone, mapboxConfigured } from '@/lib/mapbox/server';
import { isValidLatLng } from '@/lib/delivery/geo';
import { MAX_ISOCHRONE_MINUTES } from '@/lib/delivery/matching';

/**
 * POST /api/business/delivery/isochrone
 *
 * Turns a drive time into a polygon. Called by the area editor's "Generate
 * zone" button, never by checkout: the resulting geometry is stored on the
 * area, so a customer's order only ever reads the saved shape.
 *
 * Without a Mapbox token this answers 503 and the editor keeps the other three
 * area types fully usable.
 */

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const business = await getActiveBusiness();
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    if (!mapboxConfigured()) {
      return NextResponse.json(
        {
          error: 'Drive-time zones need a Mapbox token. Add NEXT_PUBLIC_MAPBOX_TOKEN in Vercel, or use a radius instead.',
          code: 'MAPBOX_MISSING',
        },
        { status: 503 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const center = { lat: Number(body?.lat), lng: Number(body?.lng) };
    if (!isValidLatLng(center)) {
      return NextResponse.json({ error: 'Place the centre pin on the map first.' }, { status: 400 });
    }

    const minutesRaw = Number(body?.minutes);
    if (!Number.isFinite(minutesRaw) || minutesRaw < 1 || minutesRaw > MAX_ISOCHRONE_MINUTES) {
      return NextResponse.json(
        { error: `Choose a drive time between 1 and ${MAX_ISOCHRONE_MINUTES} minutes.` },
        { status: 400 },
      );
    }

    const geometry = await fetchIsochrone(center, minutesRaw, 'mapbox/driving');
    if (!geometry) {
      return NextResponse.json(
        { error: 'Mapbox could not build that zone. Try a shorter drive time.' },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, geometry });
  } catch (error) {
    console.error('[delivery/isochrone] failed', error);
    return NextResponse.json({ error: 'Could not build the drive-time zone.' }, { status: 500 });
  }
}
