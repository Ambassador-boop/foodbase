/**
 * Server-side Mapbox helpers (Batch 3B).
 *
 * The token is the public one (`NEXT_PUBLIC_MAPBOX_TOKEN`) because Mapbox
 * public tokens are restricted by URL, not by secrecy, and one token keeps the
 * browser and the server looking at the same basemap.
 *
 * Every function here is total: it returns null instead of throwing when the
 * token is missing, the network is down or Mapbox answers slowly. Delivery must
 * still work without a map (straight-line estimate), and the dashboard must
 * still let an owner save fees by hand.
 */

import type { LatLng } from '@/lib/delivery/types';
import { isValidLatLng } from '@/lib/delivery/geo';

const MAPBOX_TIMEOUT_MS = 6000;

export function mapboxToken(): string | null {
  const token =
    process.env.NEXT_PUBLIC_MAPBOX_TOKEN ||
    process.env.MAPBOX_TOKEN ||
    '';
  const trimmed = token.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function mapboxConfigured(): boolean {
  return mapboxToken() !== null;
}

async function mapboxFetch(url: string): Promise<any | null> {
  const token = mapboxToken();
  if (!token) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MAPBOX_TIMEOUT_MS);
  try {
    const separator = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${separator}access_token=${encodeURIComponent(token)}`, {
      signal: controller.signal,
      // Mapbox answers are stable for a while; let the platform cache them.
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) {
      console.warn('[mapbox] request failed', response.status, url.split('?')[0]);
      return null;
    }
    return await response.json();
  } catch (error) {
    console.warn('[mapbox] request error', url.split('?')[0], error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type GeocodeResult = {
  id: string;
  /** The address line the customer will recognise. */
  name: string;
  /** Full place name, e.g. "12 Admiralty Way, Lekki, Nigeria". */
  placeName: string;
  lat: number;
  lng: number;
  /** Street or neighbourhood, used as a short label in the UI. */
  context: string | null;
};

/**
 * Forward geocoding restricted to Nigeria.
 *
 * `country=ng` is enforced here, not on the client: a restaurant in Lagos does
 * not deliver to Accra and the search should not pretend otherwise.
 */
export async function searchNigeriaAddress(
  query: string,
  options: { proximity?: LatLng | null; limit?: number } = {},
): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  const params = new URLSearchParams({
    q,
    country: 'ng',
    limit: String(Math.min(Math.max(options.limit ?? 6, 1), 10)),
    language: 'en',
    types: 'address,street,neighborhood,locality,place,poi',
    autocomplete: 'true',
  });
  if (isValidLatLng(options.proximity)) {
    params.set('proximity', `${options.proximity.lng},${options.proximity.lat}`);
  }

  const data = await mapboxFetch(
    `https://api.mapbox.com/search/geocode/v6/forward?${params.toString()}`,
  );
  if (!data || !Array.isArray(data.features)) return [];

  return data.features
    .map((feature: any): GeocodeResult | null => {
      const coordinates = feature?.geometry?.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2) return null;
      const lng = Number(coordinates[0]);
      const lat = Number(coordinates[1]);
      if (!isValidLatLng({ lat, lng })) return null;
      const properties = feature.properties ?? {};
      const name =
        properties.name_preferred ||
        properties.name ||
        properties.address_line1 ||
        properties.full_address ||
        q;
      return {
        id: String(feature.id ?? `${lat},${lng}`),
        name: String(name),
        placeName: String(properties.full_address || properties.place_formatted || name),
        lat,
        lng,
        context:
          properties.context?.neighborhood?.name ||
          properties.context?.locality?.name ||
          properties.place_formatted ||
          null,
      };
    })
    .filter((result: GeocodeResult | null): result is GeocodeResult => result !== null);
}

/**
 * Driving time in minutes between two points, or null when Mapbox cannot say.
 * Returned in minutes (rounded) because that is the unit the customer reads.
 */
export async function drivingMinutes(origin: LatLng, destination: LatLng): Promise<number | null> {
  if (!isValidLatLng(origin) || !isValidLatLng(destination)) return null;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/` +
    `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
    `?overview=false&alternatives=false&steps=false`;
  const data = await mapboxFetch(url);
  const route = data?.routes?.[0];
  const seconds = Number(route?.duration);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return seconds / 60;
}

export async function drivingDistanceMeters(
  origin: LatLng,
  destination: LatLng,
): Promise<number | null> {
  if (!isValidLatLng(origin) || !isValidLatLng(destination)) return null;
  const url =
    `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/` +
    `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
    `?overview=false&alternatives=false&steps=false`;
  const data = await mapboxFetch(url);
  const distance = Number(data?.routes?.[0]?.distance);
  return Number.isFinite(distance) && distance > 0 ? distance : null;
}

/**
 * Isochrone: the polygon reachable within N minutes of driving.
 * Returns a normalised Polygon/MultiPolygon geometry ready to store.
 */
export async function fetchIsochrone(
  center: LatLng,
  minutes: number,
  profile = 'mapbox/driving',
): Promise<{ type: 'Polygon' | 'MultiPolygon'; coordinates: any } | null> {
  if (!isValidLatLng(center)) return null;
  const safeMinutes = Math.min(Math.max(Math.round(minutes), 1), 60);
  const safeProfile = /^mapbox\/[a-z-]+$/.test(profile) ? profile : 'mapbox/driving';
  const url =
    `https://api.mapbox.com/isochrone/v1/${safeProfile}/` +
    `${center.lng},${center.lat}?contours_minutes=${safeMinutes}&polygons=true&denoise=1&generalize=50`;
  const data = await mapboxFetch(url);
  const feature = data?.features?.[0];
  const geometry = feature?.geometry;
  if (!geometry || (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon')) return null;
  return { type: geometry.type, coordinates: geometry.coordinates };
}
