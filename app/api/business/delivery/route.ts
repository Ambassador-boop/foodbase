import { NextRequest, NextResponse } from 'next/server';
import { query, getOne } from '@/lib/db';
import { getActiveBusiness } from '@/lib/active-business';
import { generateAlphanumericId } from '@/lib/utils';
import { mapboxConfigured } from '@/lib/mapbox/server';
import { MAX_PREP_MINUTES, MIN_PREP_MINUTES, prepMinutesOr } from '@/lib/delivery/estimate';
import {
  getSchemaSupport,
  loadAreas,
  loadBusinessLocation,
} from '@/lib/delivery/storage';

/**
 * GET   /api/business/delivery   Everything the delivery screen and the
 *                                onboarding step need in one request.
 * PATCH /api/business/delivery   Kitchen prep time and the restaurant's own pin.
 *
 * Both are owner-scoped through `getActiveBusiness()`, which resolves the
 * business from the session and the `current_business_id` cookie. A business id
 * is never taken from the request body.
 */

export const runtime = 'nodejs';

export async function GET() {
  try {
    const business = await getActiveBusiness();
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const support = await getSchemaSupport();
    const [areas, location] = await Promise.all([
      loadAreas(business.id),
      loadBusinessLocation(business.id),
    ]);

    return NextResponse.json({
      success: true,
      schema: {
        deliveryAreas: support.deliveryAreas,
        businessGeo: support.businessGeo,
        prepTime: support.prepTime,
      },
      mapboxConfigured: mapboxConfigured(),
      prepTimeMinutes:
        support.prepTime && business.prep_time_minutes != null
          ? prepMinutesOr(Number(business.prep_time_minutes))
          : prepMinutesOr(null),
      prepTimeIsSet: support.prepTime && business.prep_time_minutes != null,
      location,
      address: business.address ?? null,
      city: business.city ?? null,
      state: business.state ?? null,
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        address: business.address ?? null,
      },
      areas,
    });
  } catch (error) {
    console.error('[business/delivery] read failed', error);
    return NextResponse.json({ error: 'Could not load delivery settings.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const business = await getActiveBusiness();
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const support = await getSchemaSupport();
    const body = await request.json().catch(() => ({}));
    const updates: string[] = [];
    const values: any[] = [];
    const errors: Record<string, string> = {};

    if (body?.prepTimeMinutes !== undefined) {
      if (!support.prepTime) {
        return NextResponse.json(
          { error: 'Kitchen prep time needs a one-time database update.', code: 'SCHEMA_MISSING' },
          { status: 503 },
        );
      }
      const raw = Number(body.prepTimeMinutes);
      if (!Number.isFinite(raw) || raw < MIN_PREP_MINUTES || raw > MAX_PREP_MINUTES) {
        errors.prepTimeMinutes = `Enter a prep time between ${MIN_PREP_MINUTES} and ${MAX_PREP_MINUTES} minutes.`;
      } else {
        values.push(Math.round(raw));
        updates.push(`prep_time_minutes = $${values.length}`);
      }
    }

    if (body?.latitude !== undefined || body?.longitude !== undefined) {
      if (!support.businessGeo) {
        return NextResponse.json(
          { error: 'The restaurant pin needs a one-time database update.', code: 'SCHEMA_MISSING' },
          { status: 503 },
        );
      }
      const lat = Number(body?.latitude);
      const lng = Number(body?.longitude);
      if (
        !Number.isFinite(lat) || !Number.isFinite(lng) ||
        Math.abs(lat) > 90 || Math.abs(lng) > 180
      ) {
        errors.location = 'Place the restaurant pin on the map first.';
      } else {
        values.push(lat);
        updates.push(`latitude = $${values.length}`);
        values.push(lng);
        updates.push(`longitude = $${values.length}`);
      }
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: 'Please check the values.', fields: errors }, { status: 400 });
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    }

    values.push(business.id);
    await query(
      `UPDATE businesses SET ${updates.join(', ')} WHERE id = $${values.length}`,
      values,
    );

    // Keep the row in sync for the response without a second round trip guess.
    const fresh = await getOne(
      `SELECT id, prep_time_minutes${support.businessGeo ? ', latitude, longitude' : ''}
         FROM businesses WHERE id = $1`,
      [business.id],
    );

    return NextResponse.json({
      success: true,
      prepTimeMinutes: prepMinutesOr(fresh?.prep_time_minutes ?? null),
      location:
        support.businessGeo && fresh?.latitude != null && fresh?.longitude != null
          ? { lat: Number(fresh.latitude), lng: Number(fresh.longitude) }
          : null,
    });
  } catch (error) {
    console.error('[business/delivery] update failed', error);
    return NextResponse.json({ error: 'Could not save delivery settings.' }, { status: 500 });
  }
}

/** Exposed for the create route so both use one id format. */
export function newAreaId(): string {
  return generateAlphanumericId();
}
