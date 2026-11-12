/**
 * Delivery area matching and fee rules (Batch 3B).
 *
 * The rule the whole batch hangs on: **the smallest matching area wins**. A
 * restaurant draws a 20-minute drive-time zone at ₦2,500 and, inside it, a
 * tighter 10-minute zone at ₦1,500. A customer a kilometre away must pay
 * ₦1,500, not ₦2,500, and not "whichever row was created last".
 *
 * Size is compared by measured area, which is why `area_sqm` is stored when an
 * area is saved. Flat areas have no shape and are always the largest thing on
 * the map, so any drawn area beats them. `priority` (lower first) is the
 * explicit tie-break for two areas of the same size, and created_at settles the
 * rest so the answer is never random.
 */

import {
  isValidLatLng,
  pointInCircle,
  pointInPolygon,
  polygonAreaSqm,
  polygonRings,
} from '@/lib/delivery/geo';
import type { DeliveryArea, LatLng } from '@/lib/delivery/types';

export const MAX_ISOCHRONE_MINUTES = 60;
export const MIN_RADIUS_M = 200;
export const MAX_RADIUS_M = 50000;

/** Legacy flat fee when the delivery tables do not exist yet. */
export const LEGACY_DELIVERY_FEE = 1000;

/** Does this area cover the point? Boundaries count as inside. */
export function areaContainsPoint(area: DeliveryArea, point: LatLng): boolean {
  switch (area.area_type) {
    case 'flat':
      // A flat area is a price, not a place: it covers the whole city.
      return true;
    case 'radius': {
      if (!isValidLatLng({ lat: area.center_lat ?? NaN, lng: area.center_lng ?? NaN })) {
        return false;
      }
      const radius = Number(area.radius_m);
      if (!(radius > 0)) return false;
      return pointInCircle(point, { lat: Number(area.center_lat), lng: Number(area.center_lng) }, radius);
    }
    case 'polygon':
      return pointInPolygon(point, area.polygon);
    case 'isochrone':
      return pointInPolygon(point, area.isochrone_geometry);
    default:
      return false;
  }
}

/**
 * Measured size used to rank areas. Flat is Infinity so any drawn zone wins;
 * a polygon with no stored measurement is measured on the spot rather than
 * silently losing to a bigger area.
 */
export function areaRankSizeSqm(area: DeliveryArea): number {
  if (area.area_type === 'flat') return Number.POSITIVE_INFINITY;

  const stored = Number(area.area_sqm);
  if (Number.isFinite(stored) && stored > 0) return stored;

  if (area.area_type === 'polygon') {
    const measured = polygonAreaSqm(area.polygon);
    return measured > 0 ? measured : Number.POSITIVE_INFINITY;
  }
  if (area.area_type === 'isochrone') {
    const measured = polygonAreaSqm(area.isochrone_geometry);
    return measured > 0 ? measured : Number.POSITIVE_INFINITY;
  }
  if (area.area_type === 'radius') {
    const radius = Number(area.radius_m);
    return radius > 0 ? Math.PI * radius * radius : Number.POSITIVE_INFINITY;
  }
  return Number.POSITIVE_INFINITY;
}

function createdAtMs(area: DeliveryArea): number {
  const raw = area.created_at ? Date.parse(String(area.created_at)) : NaN;
  return Number.isFinite(raw) ? raw : 0;
}

/** Every active area that covers the point, smallest first. */
export function matchingAreas(areas: DeliveryArea[], point: LatLng): DeliveryArea[] {
  return areas
    .filter((area) => area.is_active && areaContainsPoint(area, point))
    .sort((a, b) => {
      const sizeA = areaRankSizeSqm(a);
      const sizeB = areaRankSizeSqm(b);
      if (sizeA !== sizeB) return sizeA - sizeB;
      const priorityA = Number(a.priority) || 0;
      const priorityB = Number(b.priority) || 0;
      if (priorityA !== priorityB) return priorityA - priorityB;
      return createdAtMs(a) - createdAtMs(b);
    });
}

/** The single area that decides the fee for this point, or null. */
export function matchArea(areas: DeliveryArea[], point: LatLng): DeliveryArea | null {
  const matches = matchingAreas(areas, point);
  return matches.length > 0 ? matches[0] : null;
}

export type FeeResult = {
  fee: number;
  baseFee: number;
  feeWaived: boolean;
  remainingForFreeDelivery: number | null;
  belowMinimum: boolean;
  remainingForMinimum: number | null;
};

/**
 * Turn an area plus a subtotal into the amount to charge.
 *
 * Order of operations matters and is deliberate:
 *  1. minimum order is checked first, because a ₦900 basket in a ₦1,500 zone is
 *     not a free-delivery question, it is an "add more food" question;
 *  2. the free-delivery threshold then zeroes the fee and the minimum no longer
 *     applies, because spending past the threshold is exactly what the owner
 *     asked for.
 */
export function feeForArea(area: DeliveryArea, subtotal: number): FeeResult {
  const baseFee = Math.max(0, Number(area.fee) || 0);
  const minOrder = Number(area.min_order);
  const threshold = Number(area.free_delivery_threshold);

  const hasMin = Number.isFinite(minOrder) && minOrder > 0;
  const hasThreshold = Number.isFinite(threshold) && threshold > 0;

  const belowMinimum = hasMin && subtotal < minOrder;
  const freeApplied = hasThreshold && subtotal >= threshold;
  const feeWaived = baseFee > 0 && freeApplied;
  const fee = baseFee === 0 || freeApplied ? 0 : baseFee;

  return {
    fee,
    baseFee,
    feeWaived,
    remainingForFreeDelivery:
      hasThreshold && !freeApplied ? Math.max(0, round2(threshold - subtotal)) : null,
    belowMinimum,
    remainingForMinimum: belowMinimum ? Math.max(0, round2(minOrder - subtotal)) : null,
  };
}

/** Kept local so this module has no import cycle with lib/pricing. */
function round2(amount: number): number {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

/** Field validation shared by the create and update endpoints. */
export type AreaInput = {
  name?: unknown;
  area_type?: unknown;
  fee?: unknown;
  min_order?: unknown;
  free_delivery_threshold?: unknown;
  is_active?: unknown;
  priority?: unknown;
  center_lat?: unknown;
  center_lng?: unknown;
  radius_m?: unknown;
  polygon?: unknown;
  isochrone_minutes?: unknown;
  isochrone_profile?: unknown;
  isochrone_geometry?: unknown;
};

export type ValidatedArea = {
  name: string;
  area_type: DeliveryArea['area_type'];
  fee: number;
  min_order: number | null;
  free_delivery_threshold: number | null;
  is_active: boolean;
  priority: number;
  center_lat: number | null;
  center_lng: number | null;
  radius_m: number | null;
  polygon: DeliveryArea['polygon'];
  isochrone_minutes: number | null;
  isochrone_profile: string | null;
  isochrone_geometry: DeliveryArea['isochrone_geometry'];
  area_sqm: number;
};

function optionalMoney(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return round2(n);
}

function normaliseGeometry(value: unknown): DeliveryArea['polygon'] {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { type?: unknown; coordinates?: unknown };
  if (candidate.type !== 'Polygon' && candidate.type !== 'MultiPolygon') return null;
  if (!Array.isArray(candidate.coordinates)) return null;
  return { type: candidate.type, coordinates: candidate.coordinates };
}

/** True when at least one ring has three or more usable vertices. */
function hasDrawableRing(geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: any }): boolean {
  return polygonRings(geometry).some((ring) => ring.outer.length >= 3);
}

export type ValidationResult =
  | { ok: true; value: ValidatedArea }
  | { ok: false; errors: Record<string, string> };

/** Validate one area before it is written. Messages are shown verbatim. */
export function validateAreaInput(input: AreaInput): ValidationResult {
  const errors: Record<string, string> = {};

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length < 1) errors.name = 'Give the area a name customers would recognise, for example "Lekki Phase 1".';
  if (name.length > 60) errors.name = 'Keep the name under 60 characters.';

  const areaType = input.area_type;
  if (areaType !== 'flat' && areaType !== 'radius' && areaType !== 'polygon' && areaType !== 'isochrone') {
    errors.area_type = 'Choose an area type.';
  }

  const feeRaw = Number(input.fee);
  if (!Number.isFinite(feeRaw) || feeRaw < 0) errors.fee = 'Enter the delivery fee in naira. Use 0 for free delivery.';
  if (Number.isFinite(feeRaw) && feeRaw > 1_000_000) errors.fee = 'That fee is above ₦1,000,000. Check the amount.';

  const minOrder = optionalMoney(input.min_order);
  if (input.min_order !== null && input.min_order !== undefined && input.min_order !== '' && minOrder === null) {
    errors.min_order = 'Enter a minimum order in naira, or leave it empty.';
  }

  const threshold = optionalMoney(input.free_delivery_threshold);
  if (
    input.free_delivery_threshold !== null &&
    input.free_delivery_threshold !== undefined &&
    input.free_delivery_threshold !== '' &&
    threshold === null
  ) {
    errors.free_delivery_threshold = 'Enter a free-delivery threshold in naira, or leave it empty.';
  }

  if (minOrder !== null && threshold !== null && threshold < minOrder) {
    errors.free_delivery_threshold = 'The free-delivery threshold is below the minimum order, so it can never apply.';
  }

  const priorityRaw = Number(input.priority);
  const priority = Number.isFinite(priorityRaw) ? Math.round(priorityRaw) : 0;

  let centerLat: number | null = null;
  let centerLng: number | null = null;
  if (areaType === 'radius' || areaType === 'isochrone') {
    const lat = Number(input.center_lat);
    const lng = Number(input.center_lng);
    if (!isValidLatLng({ lat, lng })) {
      errors.center = 'Place the centre pin on the map, or search the restaurant address.';
    } else {
      centerLat = lat;
      centerLng = lng;
    }
  }

  let radiusM: number | null = null;
  if (areaType === 'radius') {
    const radius = Number(input.radius_m);
    if (!Number.isFinite(radius) || radius < MIN_RADIUS_M || radius > MAX_RADIUS_M) {
      errors.radius_m = `Choose a radius between ${MIN_RADIUS_M / 1000} km and ${MAX_RADIUS_M / 1000} km.`;
    } else {
      radiusM = Math.round(radius);
    }
  }

  const polygon = areaType === 'polygon' ? normaliseGeometry(input.polygon) : null;
  if (areaType === 'polygon') {
    if (!polygon) {
      errors.polygon = 'Draw the area on the map. At least three points are needed.';
    } else if (!hasDrawableRing(polygon)) {
      // A two-point "polygon" would store fine and then match nothing, which is
      // worse than refusing it now.
      errors.polygon = 'That shape is too small to use. Add at least three points that enclose an area.';
    } else if (polygonAreaSqm(polygon) <= 0) {
      errors.polygon = 'That shape has no area. Redraw it with three points or more.';
    }
  }

  let isochroneMinutes: number | null = null;
  if (areaType === 'isochrone') {
    const minutes = Number(input.isochrone_minutes);
    if (!Number.isFinite(minutes) || minutes < 1 || minutes > MAX_ISOCHRONE_MINUTES) {
      errors.isochrone_minutes = `Choose a drive time between 1 and ${MAX_ISOCHRONE_MINUTES} minutes.`;
    } else {
      isochroneMinutes = Math.round(minutes);
    }
  }

  const isochroneGeometry = areaType === 'isochrone' ? normaliseGeometry(input.isochrone_geometry) : null;
  if (areaType === 'isochrone') {
    if (!isochroneGeometry) {
      errors.isochrone_geometry = 'Generate the drive-time zone before saving.';
    } else if (!hasDrawableRing(isochroneGeometry)) {
      errors.isochrone_geometry = 'That zone came back empty. Try a longer drive time.';
    }
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  // Measured size, stored once so matching never has to recompute it.
  let areaSqm = 0;
  if (areaType === 'polygon' && polygon) areaSqm = polygonAreaSqm(polygon);
  else if (areaType === 'isochrone' && isochroneGeometry) areaSqm = polygonAreaSqm(isochroneGeometry);
  else if (areaType === 'radius' && radiusM) areaSqm = Math.PI * radiusM * radiusM;
  // Flat areas cover everything, so they carry no measurement (ranked largest).

  return {
    ok: true,
    value: {
      name,
      area_type: areaType as DeliveryArea['area_type'],
      fee: round2(feeRaw),
      min_order: minOrder,
      free_delivery_threshold: threshold,
      is_active: input.is_active === undefined ? true : Boolean(input.is_active),
      priority,
      center_lat: centerLat,
      center_lng: centerLng,
      radius_m: radiusM,
      polygon,
      isochrone_minutes: isochroneMinutes,
      isochrone_profile:
        areaType === 'isochrone'
          ? typeof input.isochrone_profile === 'string' && input.isochrone_profile.trim()
            ? input.isochrone_profile.trim().slice(0, 40)
            : 'mapbox/driving'
          : null,
      isochrone_geometry: isochroneGeometry,
      area_sqm: areaSqm,
    },
  };
}
