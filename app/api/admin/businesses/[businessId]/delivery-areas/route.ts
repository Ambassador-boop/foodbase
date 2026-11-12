import { NextRequest, NextResponse } from 'next/server';
import { isAdminAuth, requireAdmin } from '@/lib/admin-auth';
import { getOne } from '@/lib/db';
import {
  getSchemaSupport,
  loadAreas,
  loadBusinessLocation,
  loadTableLabels,
} from '@/lib/delivery/storage';

/**
 * GET /api/admin/businesses/[businessId]/delivery-areas
 *
 * Read-only support view. An admin needs to answer "why was I charged ₦2,500
 * to Ikeja?" without being able to change a restaurant's prices from here.
 * There is deliberately no POST, PATCH or DELETE in this file.
 */

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const auth = await requireAdmin(request);
  if (!isAdminAuth(auth)) return auth;

  try {
    const { businessId } = await params;
    const business = await getOne(
      'SELECT id, name, slug, address, city, state FROM businesses WHERE id = $1',
      [businessId],
    );
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    const support = await getSchemaSupport();
    const [areas, location, labels] = await Promise.all([
      loadAreas(businessId),
      loadBusinessLocation(businessId),
      loadTableLabels(businessId),
    ]);

    return NextResponse.json({
      success: true,
      readOnly: true,
      business,
      schema: { deliveryAreas: support.deliveryAreas, tableLabels: support.tableLabels },
      location,
      areas,
      tableLabels: labels.filter((label) => label.is_active),
    });
  } catch (error) {
    console.error('[admin/delivery-areas] failed', error);
    return NextResponse.json({ error: 'Could not load delivery areas.' }, { status: 500 });
  }
}
