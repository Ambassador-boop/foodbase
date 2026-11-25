import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeliveryArea } from '@/lib/delivery/types';

/**
 * Delivery pricing: the legacy flat fee, the free-when-unconfigured rule, the
 * refusal codes, the smallest-area rule, and the minimum/threshold ordering.
 *
 * The database is replaced by a stub here. Nothing in this file opens a
 * connection; the storage module is the only thing mocked and it is mocked
 * completely.
 */

const support = { deliveryAreas: true };

// vi.hoisted so the mock factory can see the stub: vi.mock is lifted above the
// imports, and a plain const would not exist yet when it runs.
const storage = vi.hoisted(() => ({
  getSchemaSupport: vi.fn(),
  loadActiveAreas: vi.fn(),
  loadBusinessLocation: vi.fn(),
  loadPrepTimeMinutes: vi.fn(),
}));

vi.mock('@/lib/delivery/storage', () => storage);

import { feeForArea, matchArea, LEGACY_DELIVERY_FEE } from '@/lib/delivery/matching';
import { resolveDelivery } from '@/lib/delivery/pricing';

function area(overrides: Partial<DeliveryArea> = {}): DeliveryArea {
  return {
    id: 'area_1',
    business_id: 'bus_1',
    name: 'Central',
    area_type: 'flat',
    fee: 1500,
    min_order: 0,
    free_delivery_threshold: null,
    is_active: true,
    priority: 0,
    center_lat: null,
    center_lng: null,
    radius_m: null,
    polygon: null,
    isochrone_minutes: null,
    isochrone_profile: null,
    isochrone_geometry: null,
    area_sqm: 0,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  } as DeliveryArea;
}

const point = { lat: 6.4541, lng: 3.3947 };

beforeEach(() => {
  storage.getSchemaSupport.mockResolvedValue({ deliveryAreas: true });
  storage.loadActiveAreas.mockResolvedValue([]);
  storage.loadBusinessLocation.mockResolvedValue(null);
  storage.loadPrepTimeMinutes.mockResolvedValue(null);
});

describe('resolveDelivery: pickup', () => {
  it('charges nothing when the customer collects', async () => {
    const result = await resolveDelivery({ businessId: 'bus_1', deliveryType: 'restaurant', subtotal: 5000 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.fee).toBe(0);
  });
});

describe('resolveDelivery: legacy behaviour', () => {
  it('uses the flat ₦1,000 when the delivery-area table is missing', async () => {
    storage.getSchemaSupport.mockResolvedValue({ deliveryAreas: false });
    const result = await resolveDelivery({ businessId: 'bus_1', deliveryType: 'delivery', point, subtotal: 5000 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fee).toBe(LEGACY_DELIVERY_FEE);
      expect(result.legacy).toBe(true);
    }
  });

  it('is free when the table exists but no area is active', async () => {
    const result = await resolveDelivery({ businessId: 'bus_1', deliveryType: 'delivery', point, subtotal: 5000 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fee).toBe(0);
      expect(result.legacy).toBe(false);
    }
  });
});

describe('resolveDelivery: refusals', () => {
  it('asks for coordinates when areas exist but the point is missing', async () => {
    storage.loadActiveAreas.mockResolvedValue([area()]);
    const result = await resolveDelivery({ businessId: 'bus_1', deliveryType: 'delivery', point: null, subtotal: 5000 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('COORDS_REQUIRED');
  });

  it('refuses an address outside every area', async () => {
    storage.loadActiveAreas.mockResolvedValue([
      area({ area_type: 'radius', center_lat: 6.5, center_lng: 3.5, radius_m: 200, fee: 2000 }),
    ]);
    const result = await resolveDelivery({ businessId: 'bus_1', deliveryType: 'delivery', point, subtotal: 5000 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('OUTSIDE_AREA');
      expect(result.outsideArea).toBe(true);
    }
  });

  it('refuses a basket below the area minimum and reports the gap', async () => {
    storage.loadActiveAreas.mockResolvedValue([area({ fee: 2500, min_order: 5000 })]);
    const result = await resolveDelivery({ businessId: 'bus_1', deliveryType: 'delivery', point, subtotal: 3000 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('BELOW_MINIMUM');
      expect(result.minOrder).toBe(5000);
      expect(result.remainingForMinimum).toBe(2000);
    }
  });
});

describe('resolveDelivery: pricing', () => {
  it('charges the matched area fee', async () => {
    storage.loadActiveAreas.mockResolvedValue([area({ fee: 1500 })]);
    const result = await resolveDelivery({ businessId: 'bus_1', deliveryType: 'delivery', point, subtotal: 5000 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.fee).toBe(1500);
  });

  it('waives the fee at the free-delivery threshold', async () => {
    storage.loadActiveAreas.mockResolvedValue([area({ fee: 1500, free_delivery_threshold: 10000 })]);
    const result = await resolveDelivery({ businessId: 'bus_1', deliveryType: 'delivery', point, subtotal: 10000 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fee).toBe(0);
      expect(result.feeWaived).toBe(true);
      expect(result.baseFee).toBe(1500);
    }
  });

  it('still charges below the threshold', async () => {
    storage.loadActiveAreas.mockResolvedValue([area({ fee: 1500, free_delivery_threshold: 10000 })]);
    const result = await resolveDelivery({ businessId: 'bus_1', deliveryType: 'delivery', point, subtotal: 9999 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.fee).toBe(1500);
  });

  it('picks the smaller of two covering areas', async () => {
    storage.loadActiveAreas.mockResolvedValue([
      area({ id: 'big', area_type: 'radius', center_lat: 6.4541, center_lng: 3.3947, radius_m: 20000, fee: 2500 }),
      area({ id: 'small', area_type: 'radius', center_lat: 6.4541, center_lng: 3.3947, radius_m: 800, fee: 1200 }),
    ]);
    const result = await resolveDelivery({ businessId: 'bus_1', deliveryType: 'delivery', point, subtotal: 5000 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.fee).toBe(1200);
      expect(result.area?.id).toBe('small');
    }
  });
});

describe('feeForArea', () => {
  it('checks the minimum before the free-delivery threshold', () => {
    const priced = feeForArea(area({ fee: 1500, min_order: 5000, free_delivery_threshold: 4000 }), 3000);
    expect(priced.belowMinimum).toBe(true);
    expect(priced.fee).toBe(1500);
  });

  it('zeroes the fee at the threshold', () => {
    const priced = feeForArea(area({ fee: 1500, free_delivery_threshold: 5000 }), 5000);
    expect(priced.fee).toBe(0);
    expect(priced.feeWaived).toBe(true);
    expect(priced.remainingForFreeDelivery).toBeNull();
  });

  it('reports what is left to reach free delivery', () => {
    const priced = feeForArea(area({ fee: 1500, free_delivery_threshold: 8000 }), 5000);
    expect(priced.remainingForFreeDelivery).toBe(3000);
  });

  it('never returns a negative fee or a negative gap', () => {
    const priced = feeForArea(area({ fee: -500, min_order: 0 }), 1000);
    expect(priced.fee).toBe(0);
    expect(priced.baseFee).toBe(0);
  });

  it('treats a zero fee as free, not as a waiver', () => {
    const priced = feeForArea(area({ fee: 0, free_delivery_threshold: 5000 }), 1000);
    expect(priced.fee).toBe(0);
    expect(priced.feeWaived).toBe(false);
  });

  it('ignores a nonsense threshold rather than treating it as zero', () => {
    const priced = feeForArea(area({ fee: 1500, free_delivery_threshold: null }), 100000);
    expect(priced.fee).toBe(1500);
    expect(priced.feeWaived).toBe(false);
  });

  it('rounds the remaining gap to kobo', () => {
    const priced = feeForArea(area({ fee: 1500, min_order: 1000.5 }), 999.99);
    expect(priced.remainingForMinimum).toBe(0.51);
  });
});

describe('matchArea', () => {
  it('returns null when nothing covers the point', () => {
    expect(matchArea([area({ area_type: 'radius', center_lat: 9, center_lng: 9, radius_m: 100 })], point)).toBeNull();
  });

  it('lets a drawn area beat a flat one, which covers everything', () => {
    const matched = matchArea(
      [
        area({ id: 'flat', area_type: 'flat', fee: 3000 }),
        area({ id: 'radius', area_type: 'radius', center_lat: 6.4541, center_lng: 3.3947, radius_m: 1000, fee: 1000 }),
      ],
      point,
    );
    expect(matched?.id).toBe('radius');
  });

  it('ignores inactive areas', () => {
    expect(matchArea([area({ is_active: false })], point)).toBeNull();
  });

  it('uses priority, then age, as a tie-break for equal sizes', () => {
    const a = area({ id: 'a', area_type: 'radius', center_lat: 6.4541, center_lng: 3.3947, radius_m: 1000, priority: 5, created_at: '2026-01-01T00:00:00.000Z' });
    const b = area({ id: 'b', area_type: 'radius', center_lat: 6.4541, center_lng: 3.3947, radius_m: 1000, priority: 1, created_at: '2026-02-01T00:00:00.000Z' });
    expect(matchArea([a, b], point)?.id).toBe('b');
  });
});
