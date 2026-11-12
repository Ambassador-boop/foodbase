import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getActiveBusiness } from '@/lib/active-business';
import { validateAreaInput } from '@/lib/delivery/matching';
import { getSchemaSupport, loadArea, loadAreas, normaliseAreaRow } from '@/lib/delivery/storage';

/**
 * PATCH  /api/business/delivery/areas/[id]   Edit, rename, disable or retune.
 * DELETE /api/business/delivery/areas/[id]   Remove the area.
 *
 * The update merges the stored row with the incoming patch and validates the
 * whole result, so changing an area from a radius to a polygon can never leave
 * a leftover radius behind. Orders already placed keep their own copy of the
 * fee and area id, so deleting an area does not rewrite history.
 */

export const runtime = 'nodejs';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const business = await getActiveBusiness();
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const support = await getSchemaSupport();
    if (!support.deliveryAreas) {
      return NextResponse.json(
        { error: 'Delivery areas need a one-time database update.', code: 'SCHEMA_MISSING' },
        { status: 503 },
      );
    }

    const { id } = await params;
    const current = await loadArea(business.id, id);
    if (!current) return NextResponse.json({ error: 'Area not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));

    // Merge: body wins, everything omitted keeps its stored value.
    const merged = {
      name: body?.name !== undefined ? body.name : current.name,
      area_type: body?.area_type !== undefined ? body.area_type : current.area_type,
      fee: body?.fee !== undefined ? body.fee : current.fee,
      min_order: body?.min_order !== undefined ? body.min_order : current.min_order,
      free_delivery_threshold:
        body?.free_delivery_threshold !== undefined
          ? body.free_delivery_threshold
          : current.free_delivery_threshold,
      is_active: body?.is_active !== undefined ? body.is_active : current.is_active,
      priority: body?.priority !== undefined ? body.priority : current.priority,
      center_lat: body?.center_lat !== undefined ? body.center_lat : current.center_lat,
      center_lng: body?.center_lng !== undefined ? body.center_lng : current.center_lng,
      radius_m: body?.radius_m !== undefined ? body.radius_m : current.radius_m,
      polygon: body?.polygon !== undefined ? body.polygon : current.polygon,
      isochrone_minutes:
        body?.isochrone_minutes !== undefined ? body.isochrone_minutes : current.isochrone_minutes,
      isochrone_profile:
        body?.isochrone_profile !== undefined ? body.isochrone_profile : current.isochrone_profile,
      isochrone_geometry:
        body?.isochrone_geometry !== undefined ? body.isochrone_geometry : current.isochrone_geometry,
    };

    const validated = validateAreaInput(merged);
    if (!validated.ok) {
      return NextResponse.json(
        { error: 'Please check the highlighted fields.', fields: validated.errors },
        { status: 400 },
      );
    }

    const value = validated.value;

    if (value.area_type === 'flat') {
      const areas = await loadAreas(business.id);
      const clash = areas.find((area) => area.area_type === 'flat' && area.id !== id);
      if (clash) {
        return NextResponse.json(
          { error: `"${clash.name}" is already your flat fee for every address.` },
          { status: 400 },
        );
      }
    }

    const rows = await query(
      `UPDATE delivery_areas SET
         name = $1, area_type = $2, fee = $3, min_order = $4, free_delivery_threshold = $5,
         is_active = $6, priority = $7, center_lat = $8, center_lng = $9, radius_m = $10,
         polygon = $11::jsonb, isochrone_minutes = $12, isochrone_profile = $13,
         isochrone_geometry = $14::jsonb, area_sqm = $15, updated_at = NOW()
       WHERE id = $16 AND business_id = $17
       RETURNING *`,
      [
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
        id,
        business.id,
      ],
    );

    const updated = Array.isArray(rows) ? rows[0] : null;
    return NextResponse.json({
      success: true,
      area: updated ? normaliseAreaRow(updated) : null,
    });
  } catch (error) {
    console.error('[delivery/areas] update failed', error);
    return NextResponse.json({ error: 'Could not save this area.' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const business = await getActiveBusiness();
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const support = await getSchemaSupport();
    if (!support.deliveryAreas) {
      return NextResponse.json(
        { error: 'Delivery areas need a one-time database update.', code: 'SCHEMA_MISSING' },
        { status: 503 },
      );
    }

    const { id } = await params;
    const current = await loadArea(business.id, id);
    if (!current) return NextResponse.json({ error: 'Area not found' }, { status: 404 });

    await query('DELETE FROM delivery_areas WHERE id = $1 AND business_id = $2', [id, business.id]);

    return NextResponse.json({ success: true, removed: id });
  } catch (error) {
    console.error('[delivery/areas] delete failed', error);
    return NextResponse.json({ error: 'Could not remove this area.' }, { status: 500 });
  }
}
