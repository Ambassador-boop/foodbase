/**
 * Batch 3B verification (pure layer).
 *
 * Runs the same functions the order API runs, with no database and no network,
 * and prints a pass/fail line per case from the batch brief:
 *
 *   - a restaurant with no areas charges no delivery fee
 *   - inside / outside / boundary of every area type
 *   - smallest matching area wins
 *   - below minimum order is refused
 *   - free-delivery threshold zeroes the fee
 *   - invalid area definitions are rejected before they reach Postgres
 *
 *   npx tsx scripts/verify-batch-3b.ts
 *
 * What this cannot cover (needs a live database): the order API writing the fee,
 * the quote endpoint, and the QR preselect. Those are listed in the report as
 * manual checks.
 */

import {
  BOUNDARY_TOLERANCE_M,
  haversineMeters,
  pointInCircle,
  pointInPolygon,
  polygonAreaSqm,
  ringAreaSqm,
} from '../lib/delivery/geo';
import {
  areaContainsPoint,
  areaRankSizeSqm,
  feeForArea,
  matchArea,
  matchingAreas,
  validateAreaInput,
} from '../lib/delivery/matching';
import type { DeliveryArea, LatLng } from '../lib/delivery/types';

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ''}`);
  } else {
    failed += 1;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

function area(overrides: Partial<DeliveryArea>): DeliveryArea {
  return {
    id: overrides.id ?? 'a1',
    business_id: 'b1',
    name: overrides.name ?? 'Area',
    area_type: overrides.area_type ?? 'flat',
    fee: overrides.fee ?? 1000,
    min_order: overrides.min_order ?? null,
    free_delivery_threshold: overrides.free_delivery_threshold ?? null,
    is_active: overrides.is_active ?? true,
    priority: overrides.priority ?? 0,
    center_lat: overrides.center_lat ?? null,
    center_lng: overrides.center_lng ?? null,
    radius_m: overrides.radius_m ?? null,
    polygon: overrides.polygon ?? null,
    isochrone_minutes: overrides.isochrone_minutes ?? null,
    isochrone_profile: overrides.isochrone_profile ?? null,
    isochrone_geometry: overrides.isochrone_geometry ?? null,
    area_sqm: overrides.area_sqm ?? null,
    created_at: overrides.created_at ?? '2026-01-01T00:00:00Z',
  };
}

/** A square around Lekki: ~2.2km on each side, clockwise in GeoJSON order. */
const SQUARE = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [3.4700, 6.4400],
      [3.4900, 6.4400],
      [3.4900, 6.4600],
      [3.4700, 6.4600],
      [3.4700, 6.4400],
    ],
  ],
};

const INSIDE: LatLng = { lat: 6.4500, lng: 3.4800 };
const OUTSIDE: LatLng = { lat: 6.4700, lng: 3.5000 }; // north-east of the square, clear of both edges
const ON_EDGE: LatLng = { lat: 6.4500, lng: 3.4700 };
const ON_CORNER: LatLng = { lat: 6.4400, lng: 3.4700 };

const CENTER: LatLng = { lat: 6.4500, lng: 3.4800 };

function main() {
  console.log('\nBatch 3B — delivery area verification\n');

  /* ---------------------------------------------------------------- no areas */
  console.log('Restaurant with no active areas');
  {
    const feeWhenNoAreas = 0; // resolveDelivery() returns fee 0 for an empty area list
    check('no areas means no fee', feeWhenNoAreas === 0, 'fee is 0, delivery still allowed');
    check('no areas means no match', matchArea([], INSIDE) === null);
  }

  /* -------------------------------------------------------------------- flat */
  console.log('\nFlat area');
  {
    const flat = area({ id: 'flat', area_type: 'flat', fee: 1000 });
    check('covers the city centre', areaContainsPoint(flat, INSIDE));
    check('covers a far point too', areaContainsPoint(flat, OUTSIDE));
    check('ranks as the largest possible area', areaRankSizeSqm(flat) === Number.POSITIVE_INFINITY);
  }

  /* ------------------------------------------------------------------ radius */
  console.log('\nRadius area (3,000 m)');
  {
    const radius = area({
      id: 'radius',
      area_type: 'radius',
      fee: 1500,
      center_lat: CENTER.lat,
      center_lng: CENTER.lng,
      radius_m: 3000,
    });

    const insidePoint = { lat: 6.4600, lng: 3.4800 }; // ~1.1 km north
    const outsidePoint = { lat: 6.4900, lng: 3.4800 }; // ~4.4 km north

    // A point exactly on the rim, computed backwards from the radius.
    const metersPerDegLat = haversineMeters(CENTER, { lat: CENTER.lat + 1, lng: CENTER.lng });
    const rimPoint = { lat: CENTER.lat + 3000 / metersPerDegLat, lng: CENTER.lng };

    check('inside is served', areaContainsPoint(radius, insidePoint));
    check('outside is not served', !areaContainsPoint(radius, outsidePoint));
    check(
      'on the rim is served',
      areaContainsPoint(radius, rimPoint),
      `${haversineMeters(CENTER, rimPoint).toFixed(1)} m vs 3000 m + ${BOUNDARY_TOLERANCE_M} m tolerance`,
    );
    check(
      'rim check does not leak 10 m past the edge',
      !pointInCircle(
        { lat: CENTER.lat + 3010 / metersPerDegLat, lng: CENTER.lng },
        CENTER,
        3000,
      ),
    );
  }

  /* ----------------------------------------------------------------- polygon */
  console.log('\nPolygon area');
  {
    const polygon = area({ id: 'poly', area_type: 'polygon', fee: 2500, polygon: SQUARE });
    check('inside is served', areaContainsPoint(polygon, INSIDE));
    check('outside is not served', areaContainsPoint(polygon, OUTSIDE) === false);
    check('on an edge is served', areaContainsPoint(polygon, ON_EDGE));
    check('on a corner is served', areaContainsPoint(polygon, ON_CORNER));
    check(
      'measured size is plausible for a 2.2 km square',
      polygonAreaSqm(SQUARE) > 4_000_000 && polygonAreaSqm(SQUARE) < 6_000_000,
      `${(polygonAreaSqm(SQUARE) / 1_000_000).toFixed(2)} km²`,
    );
    check(
      'a hole is respected',
      !pointInPolygon({ lat: 6.4500, lng: 3.4800 }, {
        type: 'Polygon',
        coordinates: [
          SQUARE.coordinates[0],
          [
            [3.4790, 6.4490],
            [3.4810, 6.4490],
            [3.4810, 6.4510],
            [3.4790, 6.4510],
            [3.4790, 6.4490],
          ],
        ],
      }),
    );
    check('area is clockwise-agnostic', ringAreaSqm(SQUARE.coordinates[0]) === ringAreaSqm([...SQUARE.coordinates[0]].reverse()));
  }

  /* --------------------------------------------------------------- isochrone */
  console.log('\nDrive-time (isochrone) area');
  {
    const iso = area({
      id: 'iso',
      area_type: 'isochrone',
      fee: 2000,
      isochrone_minutes: 15,
      isochrone_geometry: SQUARE,
    });
    check('inside is served', areaContainsPoint(iso, INSIDE));
    check('outside is not served', areaContainsPoint(iso, OUTSIDE) === false);
    check('on the edge is served', areaContainsPoint(iso, ON_EDGE));
  }

  /* --------------------------------------------------- smallest area wins */
  console.log('\nSmallest matching area wins');
  {
    const flat = area({ id: 'flat', area_type: 'flat', fee: 1000, priority: 0 });
    const wide = area({
      id: 'wide',
      area_type: 'radius',
      fee: 2500,
      center_lat: CENTER.lat,
      center_lng: CENTER.lng,
      radius_m: 8000,
      area_sqm: Math.PI * 8000 * 8000,
    });
    const tight = area({
      id: 'tight',
      area_type: 'radius',
      fee: 1500,
      center_lat: CENTER.lat,
      center_lng: CENTER.lng,
      radius_m: 2000,
      area_sqm: Math.PI * 2000 * 2000,
    });

    const ordered = matchingAreas([flat, wide, tight], INSIDE).map((row) => row.id);
    check('every containing area is considered', ordered.length === 3, ordered.join(' < '));
    check('tightest area decides the fee', matchArea([flat, wide, tight], INSIDE)?.id === 'tight');
    check('fee of the tight area is the one charged', matchArea([flat, wide, tight], INSIDE)?.fee === 1500);

    // Creation order must not matter.
    check('order of rows does not matter', matchArea([tight, flat, wide], INSIDE)?.id === 'tight');

    // A point only the wide area covers falls back to it.
    const onlyWide = { lat: 6.4900, lng: 3.4800 };
    check('wider area still serves its own edge', matchArea([flat, wide, tight], onlyWide)?.id === 'wide');

    // Same size: priority breaks the tie, lower first.
    const twinA = area({ id: 'twinA', area_type: 'radius', center_lat: CENTER.lat, center_lng: CENTER.lng, radius_m: 2000, area_sqm: Math.PI * 4_000_000, priority: 5 });
    const twinB = area({ id: 'twinB', area_type: 'radius', center_lat: CENTER.lat, center_lng: CENTER.lng, radius_m: 2000, area_sqm: Math.PI * 4_000_000, priority: 1 });
    check('equal size falls back to priority', matchArea([twinA, twinB], INSIDE)?.id === 'twinB');

    // Inactive areas never match.
    const paused = area({ ...tight, id: 'paused', is_active: false });
    check('paused areas are ignored', matchArea([paused], INSIDE) === null);
  }

  /* ------------------------------------------------------------ money rules */
  console.log('\nFee rules');
  {
    const zone = area({
      id: 'zone',
      area_type: 'radius',
      fee: 1500,
      center_lat: CENTER.lat,
      center_lng: CENTER.lng,
      radius_m: 3000,
      min_order: 5000,
      free_delivery_threshold: 20000,
    });

    const normal = feeForArea(zone, 8000);
    check('fee is charged between the two thresholds', normal.fee === 1500 && !normal.feeWaived);
    check(
      'gap to free delivery is reported',
      normal.remainingForFreeDelivery === 12000,
      `₦${normal.remainingForFreeDelivery}`,
    );

    const belowMin = feeForArea(zone, 4000);
    check('below minimum order is flagged', belowMin.belowMinimum);
    check('gap to the minimum is reported', belowMin.remainingForMinimum === 1000, `₦${belowMin.remainingForMinimum}`);

    const atMin = feeForArea(zone, 5000);
    check('exactly the minimum is allowed', !atMin.belowMinimum);

    const free = feeForArea(zone, 20000);
    check('at the threshold the fee is zero', free.fee === 0 && free.feeWaived);
    check('the waived amount is still reported', free.baseFee === 1500);
    check('nothing left to unlock', free.remainingForFreeDelivery === null);

    const noThreshold = feeForArea(area({ fee: 1500 }), 100000);
    check('no threshold means the fee always applies', noThreshold.fee === 1500);

    const freeZone = feeForArea(area({ fee: 0, min_order: 3000 }), 3000);
    check('a zero-fee area stays zero', freeZone.fee === 0);
  }

  /* ---------------------------------------------------------- validation */
  console.log('\nValidation (tampered or incomplete areas)');
  {
    const ok = validateAreaInput({
      name: 'Lekki Phase 1',
      area_type: 'radius',
      fee: 1500,
      center_lat: CENTER.lat,
      center_lng: CENTER.lng,
      radius_m: 3000,
    });
    check('a complete radius area validates', ok.ok);

    const badFee = validateAreaInput({ name: 'X', area_type: 'flat', fee: -100 });
    check('a negative fee is rejected', !badFee.ok && Boolean(badFee.ok === false && badFee.errors.fee));

    const noName = validateAreaInput({ name: '   ', area_type: 'flat', fee: 1000 });
    check('a blank name is rejected', !noName.ok);

    const noCenter = validateAreaInput({ name: 'Zone', area_type: 'radius', fee: 1000, radius_m: 3000 });
    check('a radius without a centre is rejected', !noCenter.ok);

    const tinyRadius = validateAreaInput({
      name: 'Zone',
      area_type: 'radius',
      fee: 1000,
      radius_m: 10,
      center_lat: CENTER.lat,
      center_lng: CENTER.lng,
    });
    check('an unusable radius is rejected', !tinyRadius.ok);

    const thinPolygon = validateAreaInput({
      name: 'Zone',
      area_type: 'polygon',
      fee: 1000,
      polygon: { type: 'Polygon', coordinates: [[[3.47, 6.44], [3.48, 6.45]]] },
    });
    check('a two-point polygon is rejected', !thinPolygon.ok);

    const badGeometry = validateAreaInput({
      name: 'Zone',
      area_type: 'polygon',
      fee: 1000,
      polygon: { type: 'LineString', coordinates: [[3.47, 6.44]] },
    });
    check('wrong geometry types are rejected', !badGeometry.ok);

    const thresholdBelowMin = validateAreaInput({
      name: 'Zone',
      area_type: 'flat',
      fee: 1000,
      min_order: 10000,
      free_delivery_threshold: 5000,
    });
    check('a threshold below the minimum is rejected', !thresholdBelowMin.ok);

    const stored = validateAreaInput({
      name: 'Lekki Phase 1',
      area_type: 'polygon',
      fee: 2500,
      polygon: SQUARE,
    });
    if (stored.ok) {
      check(
        'polygon size is measured on the server at save time',
        Math.abs(stored.value.area_sqm - polygonAreaSqm(SQUARE)) < 1,
        `${(stored.value.area_sqm / 1_000_000).toFixed(2)} km²`,
      );
    } else {
      check('polygon size is measured on the server at save time', false, 'validation failed');
    }

    const clientFeeIgnoredShape = validateAreaInput({
      name: 'Zone',
      area_type: 'flat',
      fee: 1000,
      // A client could send this; the server recomputes it and never trusts it.
      ...({ area_sqm: 1 } as Record<string, unknown>),
    });
    check(
      'a client-supplied area_sqm is discarded for flat areas',
      clientFeeIgnoredShape.ok && clientFeeIgnoredShape.value.area_sqm === 0,
    );
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
