/**
 * Geometry for delivery areas (Batch 3B).
 *
 * Pure functions, no I/O, no Mapbox dependency: the same code runs inside the
 * order API (the only place a fee is decided) and inside the dashboard preview.
 *
 * Conventions
 *  - A point is `{ lat, lng }` in WGS84 degrees.
 *  - A polygon ring is GeoJSON order: `[lng, lat]` pairs, first === last is
 *    tolerated either way (we close it ourselves).
 *  - The boundary counts as INSIDE for every area type. A customer standing on
 *    the edge of a zone is served, because refusing an order for a metre of
 *    floating-point noise is worse than accepting it. The tolerance is expressed
 *    in metres so it is the same size everywhere in the country.
 */

import type { GeoJsonPolygon, LatLng } from '@/lib/delivery/types';

/** Points closer than this to an edge are treated as on the edge. */
export const BOUNDARY_TOLERANCE_M = 1;

const EARTH_RADIUS_M = 6378137;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in metres. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function isValidLatLng(value: unknown): value is LatLng {
  if (!value || typeof value !== 'object') return false;
  const { lat, lng } = value as LatLng;
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/* ------------------------------- rings ---------------------------------- */

export type Ring = number[][];

/** Drop a duplicated closing vertex and any non-numeric pair. */
export function normaliseRing(ring: unknown): Ring {
  if (!Array.isArray(ring)) return [];
  const points: Ring = [];
  for (const pair of ring) {
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const lng = Number(pair[0]);
    const lat = Number(pair[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    points.push([lng, lat]);
  }
  if (points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) points.pop();
  }
  return points;
}

/** Gather every ring (outer + holes) from a Polygon or MultiPolygon. */
export function polygonRings(geometry: GeoJsonPolygon | null | undefined): Array<{
  outer: Ring;
  holes: Ring[];
}> {
  if (!geometry || !Array.isArray(geometry.coordinates)) return [];
  const out: Array<{ outer: Ring; holes: Ring[] }> = [];
  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates as unknown[];
    if (!Array.isArray(rings) || rings.length === 0) return [];
    out.push({
      outer: normaliseRing(rings[0]),
      holes: rings.slice(1).map(normaliseRing).filter((hole) => hole.length >= 3),
    });
  } else if (geometry.type === 'MultiPolygon') {
    for (const polygon of geometry.coordinates as unknown[]) {
      if (!Array.isArray(polygon) || polygon.length === 0) continue;
      out.push({
        outer: normaliseRing(polygon[0]),
        holes: polygon
          .slice(1)
          .map(normaliseRing)
          .filter((hole) => hole.length >= 3),
      });
    }
  }
  return out.filter((entry) => entry.outer.length >= 3);
}

/** Distance in metres from a point to a segment, on the local tangent plane. */
function distanceToSegmentMeters(p: LatLng, a: LatLng, b: LatLng): number {
  const latRef = toRad((a.lat + b.lat + p.lat) / 3);
  const mPerDegLat = 111132.92 - 559.82 * Math.cos(2 * latRef) + 1.175 * Math.cos(4 * latRef);
  const mPerDegLng = 111412.84 * Math.cos(latRef) - 93.5 * Math.cos(3 * latRef);

  const px = (p.lng - a.lng) * mPerDegLng;
  const py = (p.lat - a.lat) * mPerDegLat;
  const bx = (b.lng - a.lng) * mPerDegLng;
  const by = (b.lat - a.lat) * mPerDegLat;

  const lengthSq = bx * bx + by * by;
  if (lengthSq === 0) return Math.hypot(px, py);
  let t = (px * bx + py * by) / lengthSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - t * bx, py - t * by);
}

/** True when the point is inside the ring or on its edge (within tolerance). */
export function pointInRing(p: LatLng, ring: Ring): boolean {
  if (ring.length < 3) return false;

  // Boundary first: an exact edge answer must not depend on ray direction.
  for (let i = 0; i < ring.length; i++) {
    const a = { lng: ring[i][0], lat: ring[i][1] };
    const b = { lng: ring[(i + 1) % ring.length][0], lat: ring[(i + 1) % ring.length][1] };
    if (distanceToSegmentMeters(p, a, b) <= BOUNDARY_TOLERANCE_M) return true;
  }

  // Ray casting (even-odd rule) for the interior.
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects =
      yi > p.lat !== yj > p.lat &&
      p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Inside the outer ring and not inside a hole. */
export function pointInPolygon(p: LatLng, geometry: GeoJsonPolygon | null | undefined): boolean {
  const polygons = polygonRings(geometry);
  if (polygons.length === 0) return false;
  for (const { outer, holes } of polygons) {
    if (!pointInRing(p, outer)) continue;
    const inHole = holes.some((hole) => pointInRing(p, hole));
    if (!inHole) return true;
  }
  return false;
}

/** Radius areas include the rim: `distance <= radius + tolerance`. */
export function pointInCircle(p: LatLng, center: LatLng, radiusMeters: number): boolean {
  if (!(radiusMeters > 0)) return false;
  return haversineMeters(p, center) <= radiusMeters + BOUNDARY_TOLERANCE_M;
}

/**
 * Area of a ring in square metres (spherical excess, the formula Mapbox and
 * turf both use for `area`). Used only to rank overlapping areas, so a small
 * approximation error is harmless.
 */
export function ringAreaSqm(ring: Ring): number {
  if (ring.length < 3) return 0;
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    total += toRad(x2 - x1) * (2 + Math.sin(toRad(y1)) + Math.sin(toRad(y2)));
  }
  return Math.abs((total * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2);
}

/** Sum of outer rings minus holes; the comparable size of a polygon area. */
export function polygonAreaSqm(geometry: GeoJsonPolygon | null | undefined): number {
  const polygons = polygonRings(geometry);
  let total = 0;
  for (const { outer, holes } of polygons) {
    total += ringAreaSqm(outer);
    for (const hole of holes) total -= ringAreaSqm(hole);
  }
  return Math.max(0, total);
}

export function circleAreaSqm(radiusMeters: number): number {
  if (!(radiusMeters > 0)) return 0;
  return Math.PI * radiusMeters * radiusMeters;
}

/** The bounding box of a geometry, handy for centring a map. */
export function geometryBounds(geometry: GeoJsonPolygon | null | undefined): {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
} | null {
  const polygons = polygonRings(geometry);
  if (polygons.length === 0) return null;
  let minLat = 90;
  let minLng = 180;
  let maxLat = -90;
  let maxLng = -180;
  for (const { outer } of polygons) {
    for (const [lng, lat] of outer) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }
  }
  return { minLat, minLng, maxLat, maxLng };
}

/**
 * A sensible number for a "delivery coverage" headline: the sum of the areas a
 * restaurant actually serves. Flat areas have no geometry, so they are skipped.
 */
export function totalCoverageSqm(areas: Array<{ area_sqm: number | null }>): number {
  return areas.reduce((sum, area) => sum + (Number(area.area_sqm) || 0), 0);
}
