/**
 * The one place a delivery fee is decided (Batch 3B).
 *
 * Both the read-only quote endpoint and the order API call `resolveDelivery`.
 * The browser never sends a fee that is trusted, and it cannot send an area id
 * that is trusted either: the id stored on the order is the id this module
 * matched from coordinates.
 *
 * Behaviour, in the order it is applied
 * ------------------------------------
 *  1. Not a delivery order                → fee 0, nothing else considered.
 *  2. `delivery_areas` table missing      → legacy flat ₦1,000, exactly today.
 *  3. Table present, no active areas      → fee 0, delivery still allowed
 *                                           (decided behaviour for this batch).
 *  4. Active areas, no coordinates        → refuse: we cannot price a point.
 *  5. Active areas, address outside all   → refuse: "does not deliver here".
 *  6. Matched area                        → its fee, then minimum order, then
 *                                           free-delivery threshold.
 *
 * The optional SQL block in the report gives every existing business a flat
 * ₦1,000 area, which is what keeps current restaurants at today's price while
 * still letting them draw their own zones.
 */

import { isValidLatLng } from '@/lib/delivery/geo';
import { buildEstimate, prepMinutesOr, travelTime } from '@/lib/delivery/estimate';
import { LEGACY_DELIVERY_FEE, feeForArea, matchArea } from '@/lib/delivery/matching';
import {
  getSchemaSupport,
  loadActiveAreas,
  loadBusinessLocation,
  loadPrepTimeMinutes,
} from '@/lib/delivery/storage';
import type {
  DeliveryArea,
  DeliveryEstimate,
  DeliveryQuote,
  LatLng,
} from '@/lib/delivery/types';

export type DeliveryRefusalCode = 'COORDS_REQUIRED' | 'OUTSIDE_AREA' | 'BELOW_MINIMUM';

export type DeliveryResolution =
  | {
      ok: true;
      fee: number;
      baseFee: number;
      feeWaived: boolean;
      area: DeliveryArea | null;
      point: LatLng | null;
      estimate: DeliveryEstimate | null;
      prepMinutes: number;
      /** True when the legacy flat fee was used because the schema is absent. */
      legacy: boolean;
    }
  | {
      ok: false;
      code: DeliveryRefusalCode;
      message: string;
      /** Present for BELOW_MINIMUM so the UI can show the gap. */
      minOrder?: number;
      remainingForMinimum?: number;
      /** True when the refusal is "we do not deliver to this address". */
      outsideArea?: boolean;
      /** Present for BELOW_MINIMUM so the page can name the area and its fee. */
      areaName?: string;
      fee?: number;
      baseFee?: number;
      freeDeliveryThreshold?: number | null;
    };

function round2(amount: number): number {
  return Math.round((Number(amount) || 0) * 100) / 100;
}

export type ResolveDeliveryArgs = {
  businessId: string;
  deliveryType: 'delivery' | 'restaurant';
  point?: LatLng | null;
  subtotal: number;
};

export async function resolveDelivery({
  businessId,
  deliveryType,
  point,
  subtotal,
}: ResolveDeliveryArgs): Promise<DeliveryResolution> {
  if (deliveryType !== 'delivery') {
    return {
      ok: true,
      fee: 0,
      baseFee: 0,
      feeWaived: false,
      area: null,
      point: null,
      estimate: null,
      prepMinutes: prepMinutesOr(null),
      legacy: false,
    };
  }

  const [support, areas, prepRaw, restaurant] = await Promise.all([
    getSchemaSupport(),
    loadActiveAreas(businessId),
    loadPrepTimeMinutes(businessId),
    loadBusinessLocation(businessId),
  ]);
  const prepMinutes = prepMinutesOr(prepRaw);
  const validPoint = isValidLatLng(point) ? point : null;

  // 2. Schema not migrated: today's behaviour, untouched.
  if (!support.deliveryAreas) {
    const estimate = validPoint && restaurant
      ? buildEstimate(prepMinutes, (await travelTime(restaurant, validPoint))?.minutes ?? 0)
      : null;
    return {
      ok: true,
      fee: LEGACY_DELIVERY_FEE,
      baseFee: LEGACY_DELIVERY_FEE,
      feeWaived: false,
      area: null,
      point: validPoint,
      estimate,
      prepMinutes,
      legacy: true,
    };
  }

  // 3. Configured but no active area: delivery is free and still allowed.
  if (areas.length === 0) {
    const estimate = validPoint && restaurant
      ? buildEstimate(prepMinutes, (await travelTime(restaurant, validPoint))?.minutes ?? 0)
      : null;
    return {
      ok: true,
      fee: 0,
      baseFee: 0,
      feeWaived: false,
      area: null,
      point: validPoint,
      estimate,
      prepMinutes,
      legacy: false,
    };
  }

  // 4. Areas exist, so the address must resolve to a point.
  if (!validPoint) {
    return {
      ok: false,
      code: 'COORDS_REQUIRED',
      message:
        'Choose your delivery address from the search results so we can confirm it is inside a delivery area.',
    };
  }

  // 5. Outside every active area.
  const area = matchArea(areas, validPoint);
  if (!area) {
    return {
      ok: false,
      code: 'OUTSIDE_AREA',
      message: 'This restaurant does not deliver to that address.',
      outsideArea: true,
    };
  }

  // 6. Fee, minimum order, free-delivery threshold.
  const priced = feeForArea(area, subtotal);

  if (priced.belowMinimum) {
    return {
      ok: false,
      code: 'BELOW_MINIMUM',
      message: `This area has a minimum order of ₦${Number(area.min_order).toLocaleString('en-NG')}.`,
      minOrder: Number(area.min_order) || 0,
      remainingForMinimum: priced.remainingForMinimum ?? 0,
      areaName: area.name,
      fee: round2(priced.fee),
      baseFee: round2(priced.baseFee),
      freeDeliveryThreshold: Number(area.free_delivery_threshold) || null,
    };
  }

  let estimate: DeliveryEstimate | null = null;
  if (restaurant) {
    const travel = await travelTime(restaurant, validPoint);
    estimate = buildEstimate(prepMinutes, travel?.minutes ?? 0);
  } else if (isValidLatLng({ lat: area.center_lat ?? NaN, lng: area.center_lng ?? NaN })) {
    const travel = await travelTime(
      { lat: Number(area.center_lat), lng: Number(area.center_lng) },
      validPoint,
    );
    estimate = buildEstimate(prepMinutes, travel?.minutes ?? 0);
  }

  return {
    ok: true,
    fee: round2(priced.fee),
    baseFee: round2(priced.baseFee),
    feeWaived: priced.feeWaived,
    area,
    point: validPoint,
    estimate,
    prepMinutes,
    legacy: false,
  };
}

/**
 * The public quote used by checkout. Same resolver, mapped into the shape the
 * page renders. `subtotal` is only used for minimum order and thresholds; it
 * never changes the fee of the matched area.
 */
export async function quoteDelivery(args: ResolveDeliveryArgs): Promise<DeliveryQuote> {
  const resolution = await resolveDelivery(args);

  if (!resolution.ok) {
    if (resolution.code === 'BELOW_MINIMUM') {
      // A priced area that the basket does not meet: still deliverable, just
      // not yet. The page shows the gap instead of an error.
      return {
        deliverable: true,
        fee: resolution.fee ?? 0,
        baseFee: resolution.baseFee ?? 0,
        feeWaived: false,
        areaId: null,
        areaName: resolution.areaName ?? null,
        minOrder: resolution.minOrder ?? 0,
        freeDeliveryThreshold: resolution.freeDeliveryThreshold ?? null,
        remainingForFreeDelivery: null,
        belowMinimum: true,
        remainingForMinimum: resolution.remainingForMinimum ?? 0,
        estimatedMinutes: null,
        distanceMeters: null,
        legacy: false,
      };
    }
    return {
      deliverable: false,
      reason: resolution.code === 'COORDS_REQUIRED' ? 'no_coordinates' : 'outside_area',
      message: resolution.message,
    };
  }

  if (args.deliveryType !== 'delivery') {
    return {
      deliverable: true,
      fee: 0,
      baseFee: 0,
      feeWaived: false,
      areaId: null,
      areaName: null,
      minOrder: null,
      freeDeliveryThreshold: null,
      remainingForFreeDelivery: null,
      belowMinimum: false,
      remainingForMinimum: null,
      estimatedMinutes: null,
      distanceMeters: null,
      legacy: false,
    };
  }

  const area = resolution.area;
  const priced = area ? feeForArea(area, args.subtotal) : null;

  return {
    deliverable: true,
    fee: resolution.fee,
    baseFee: resolution.baseFee,
    feeWaived: resolution.feeWaived,
    areaId: area?.id ?? null,
    areaName: area?.name ?? null,
    minOrder: area ? Number(area.min_order) || null : null,
    freeDeliveryThreshold: area ? Number(area.free_delivery_threshold) || null : null,
    remainingForFreeDelivery: priced?.remainingForFreeDelivery ?? null,
    belowMinimum: false,
    remainingForMinimum: null,
    estimatedMinutes: resolution.estimate,
    distanceMeters: null,
    legacy: resolution.legacy,
  };
}
