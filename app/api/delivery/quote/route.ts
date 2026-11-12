import { NextRequest, NextResponse } from 'next/server';
import { getOne } from '@/lib/db';
import { quoteDelivery } from '@/lib/delivery/pricing';
import { isValidLatLng } from '@/lib/delivery/geo';
import { getSchemaSupport } from '@/lib/delivery/storage';

/**
 * POST /api/delivery/quote
 *
 * Read-only. Answers one question: "if this basket goes to this point, what does
 * delivery cost, and can we get there?" It writes nothing and charges nothing.
 *
 * The order API runs the same resolver again from scratch, so a stale or edited
 * quote in the browser can never change what is charged.
 */

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const businessIdRaw = typeof body?.businessId === 'string' ? body.businessId.trim() : '';
    const slugRaw = typeof body?.slug === 'string' ? body.slug.trim() : '';

    let businessId = businessIdRaw;
    if (!businessId && slugRaw) {
      const business = await getOne('SELECT id FROM businesses WHERE slug = $1', [slugRaw]);
      if (!business) {
        return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
      }
      businessId = String(business.id);
    }
    if (!businessId) {
      return NextResponse.json({ error: 'businessId or slug is required' }, { status: 400 });
    }

    const subtotalRaw = Number(body?.subtotal);
    const subtotal = Number.isFinite(subtotalRaw) && subtotalRaw > 0 ? subtotalRaw : 0;

    // Missing coordinates must stay missing: Number(null) would be 0, and
    // (0, 0) would then be reported as "outside every area" instead of
    // "choose your address".
    const latValue = typeof body?.lat === 'number' || typeof body?.lat === 'string' ? Number(body.lat) : NaN;
    const lngValue = typeof body?.lng === 'number' || typeof body?.lng === 'string' ? Number(body.lng) : NaN;
    const point = { lat: latValue, lng: lngValue };
    const hasPoint = isValidLatLng(point) && !(latValue === 0 && lngValue === 0);
    const support = await getSchemaSupport();

    const quote = await quoteDelivery({
      businessId,
      deliveryType: body?.deliveryType === 'delivery' ? 'delivery' : 'restaurant',
      point: hasPoint ? point : null,
      subtotal,
    });

    return NextResponse.json({
      success: true,
      configured: support.deliveryAreas,
      quote,
    });
  } catch (error) {
    console.error('[delivery/quote] failed', error);
    return NextResponse.json(
      { error: 'Could not check delivery for that address. Please try again.' },
      { status: 500 },
    );
  }
}
