/**
 * Delivery time estimates (Batch 3B).
 *
 * The number the customer reads is "prep time + travel time", shown as a range
 * because Lagos traffic is a range and a single number would be a lie.
 *
 * When Mapbox cannot answer (no token, no route, timeout) we fall back to a
 * straight-line estimate at an urban average. That is deliberately generous:
 * an estimate that is slightly late is a normal delivery, an estimate that is
 * early is a complaint.
 */

import type { DeliveryEstimate, LatLng } from '@/lib/delivery/types';
import { haversineMeters, isValidLatLng } from '@/lib/delivery/geo';
import { drivingMinutes } from '@/lib/mapbox/server';

/** Used when the owner has not set a kitchen prep time yet. */
export const DEFAULT_PREP_MINUTES = 20;

export const MIN_PREP_MINUTES = 1;
export const MAX_PREP_MINUTES = 240;

export function prepMinutesOr(value: number | null | undefined): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_PREP_MINUTES;
  return Math.min(Math.max(Math.round(n), MIN_PREP_MINUTES), MAX_PREP_MINUTES);
}

/** Straight-line fallback: ~18 km/h door to door in a Nigerian city. */
function fallbackTravelMinutes(meters: number): number {
  const URBAN_KMH = 18;
  return Math.max(4, (meters / 1000 / URBAN_KMH) * 60);
}

const round5 = (value: number) => Math.max(5, Math.round(value / 5) * 5);

/**
 * The range shown on checkout and stored on the order.
 *
 * `estimated_delivery_minutes` on the order holds the upper bound: the promise
 * the kitchen and the rider are measured against.
 */
export function buildEstimate(prepMinutes: number, travelMinutes: number): DeliveryEstimate {
  const base = prepMinutesOr(prepMinutes);
  const travel = Math.max(0, Number(travelMinutes) || 0);
  const min = round5(base + travel * 0.85);
  const max = round5(base + travel * 1.35 + 5);
  return { min, max: Math.max(max, min + 5) };
}

export type TravelTruth = {
  minutes: number;
  meters: number | null;
  /** 'mapbox' when Directions answered, 'fallback' when estimated. */
  source: 'mapbox' | 'fallback';
};

/** Travel time with its provenance, so callers can label the estimate honestly. */
export async function travelTime(
  from: LatLng | null,
  to: LatLng,
): Promise<TravelTruth | null> {
  if (!isValidLatLng(to)) return null;

  if (isValidLatLng(from)) {
    const minutes = await drivingMinutes(from, to);
    if (minutes && Number.isFinite(minutes)) {
      return { minutes, meters: null, source: 'mapbox' };
    }
    const meters = haversineMeters(from, to);
    // Road distance is roughly 1.3x the crow flight in a dense city.
    return { minutes: fallbackTravelMinutes(meters * 1.3), meters: Math.round(meters), source: 'fallback' };
  }

  return null;
}

export type { DeliveryEstimate };
