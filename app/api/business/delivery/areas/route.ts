import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getActiveBusiness } from '@/lib/active-business';
import { generateAlphanumericId } from '@/lib/utils';
import { validateAreaInput } from '@/lib/delivery/matching';
import { getSchemaSupport, loadAreas, normaliseAreaRow } from '@/lib/delivery/storage';

/**
 * POST /api/business/delivery/areas   Create one delivery area.
 *
 * Geometry is stored as GeoJSON and its measured size is computed once on the
 * server (`area_sqm`), so "smallest matching area wins" never depends on a
 * number the browser could have invented.
 */

export const runtime = 'nodejs';

export const MAX_AREAS_PER_BUSINESS = 50;

export async function POST(request: NextRequest) {
  try {
    const business = await getActiveBusiness();
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const support = await getSchemaSupport();
    if (!support.deliveryAreas) {
      return NextResponse.json(
        {
          error: 'Delivery areas need a one-time database update before they can be saved.',
          code: 'SCHEMA_MISSING',
        },
        { status: 503 },
      );
    }

    const existing = await loadAreas(business.id);
    if (existing.length >= MAX_AREAS_PER_BUSINESS) {
      return NextResponse.json(
        { error: `You can keep ${MAX_AREAS_PER_BUSINESS} areas. Remove one before adding another.` },
        { status: 400 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const validated = validateAreaInput(body);
    if (!validated.ok) {
      return NextResponse.json(
        { error: 'Please check the highlighted fields.', fields: validated.errors },
        { status: 400 },
      );
    }

    const value = validated.value;

    // Flat areas are a price for everywhere, and "everywhere" twice is ambiguous.
    if (value.area_type === 'flat') {
      const clash = existing.find((area) => area.area_type === 'flat');
      if (clash) {
        return NextResponse.json(
          {
            error: `"${clash.name}" is already your flat fee for every address. Edit it instead, or give this one a radius, polygon or drive-time zone.`,
          },
          { status: 400 },
        );
      }
    }

    const id = generateAlphanumericId();
    const rows = await query(
      `INSERT INTO delivery_areas
        (id, business_id, name, area_type, fee, min_order, free_delivery_threshold,
         is_active, priority, center_lat, center_lng, radius_m, polygon,
         isochrone_minutes, isochrone_profile, isochrone_geometry, area_sqm,
         created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,$16::jsonb,$17, NOW(), NOW())
       RETURNING *`,
      [
        id,
        business.id,
        value.name,
        value.area_type,
        value.fee,
        value.min_order,
        value.free_delivery_threshold,
        value.is_active,
        value.priority,
        value.center_lat,
        value.center_lng,
        value.radius_m,
        value.polygon ? JSON.stringify(value.polygon) : null,
        value.isochrone_minutes,
        value.isochrone_profile,
        value.isochrone_geometry ? JSON.stringify(value.isochrone_geometry) : null,
        Number.isFinite(value.area_sqm) ? value.area_sqm : null,
      ],
    );

    const inserted = Array.isArray(rows) ? rows[0] : null;
    return NextResponse.json({
      success: true,
      area: inserted ? normaliseAreaRow(inserted) : null,
    });
  } catch (error) {
    console.error('[delivery/areas] create failed', error);
    return NextResponse.json({ error: 'Could not save this area.' }, { status: 500 });
  }
}
