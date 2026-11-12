/**
 * Delivery area and table label domain types (Batch 3B).
 *
 * These types describe rows in `delivery_areas` and `table_labels` as they are
 * read back with `SELECT *`, so every field except `id` and `business_id` is
 * tolerant of a null (a partially configured area is still a valid row).
 *
 * Nothing here is client-only: the same shapes are used by the dashboard API,
 * the public quote endpoint and the order API.
 */

export type DeliveryAreaType = 'flat' | 'radius' | 'polygon' | 'isochrone';

export const DELIVERY_AREA_TYPES: DeliveryAreaType[] = [
  'flat',
  'radius',
  'polygon',
  'isochrone',
];

/** GeoJSON geometry, already normalised to Polygon or MultiPolygon. */
export type GeoJsonPolygon = {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: any;
};

export type DeliveryArea = {
  id: string;
  business_id: string;
  name: string;
  area_type: DeliveryAreaType;
  /** Naira. Never negative; 0 means free delivery for this area. */
  fee: number;
  /** Naira. Order subtotal below this is refused for the area, if set. */
  min_order: number | null;
  /** Naira. At or above this subtotal the fee becomes 0, if set. */
  free_delivery_threshold: number | null;
  is_active: boolean;
  /** Tie-break when two areas cover a point with the same measured size. Lower wins. */
  priority: number;
  center_lat: number | null;
  center_lng: number | null;
  radius_m: number | null;
  polygon: GeoJsonPolygon | null;
  isochrone_minutes: number | null;
  isochrone_profile: string | null;
  isochrone_geometry: GeoJsonPolygon | null;
  /** Measured size, computed when the area is saved. Drives smallest-match-wins. */
  area_sqm: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TableLabel = {
  id: string;
  business_id: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type LatLng = { lat: number; lng: number };

/** What the checkout page needs to decide whether to show the map at all. */
export type DeliveryPublicConfig = {
  /** True when the business has at least one active area. */
  hasAreas: boolean;
  /** Number of active areas, for copy like "Delivery to 3 zones". */
  activeAreaCount: number;
  prepTimeMinutes: number;
  /** False when the delivery tables have not been created yet. */
  configured: boolean;
};

export type DeliveryEstimate = {
  min: number;
  max: number;
};

export type DeliveryQuote =
  | {
      deliverable: true;
      /** Naira, after the free-delivery threshold is applied. */
      fee: number;
      areaId: string | null;
      areaName: string | null;
      /** Gross fee before the threshold, so the UI can show the saving. */
      baseFee: number;
      feeWaived: boolean;
      minOrder: number | null;
      freeDeliveryThreshold: number | null;
      /** Naira still needed to unlock free delivery, or null when not applicable. */
      remainingForFreeDelivery: number | null;
      /** True when the subtotal is under the area minimum order. */
      belowMinimum: boolean;
      /** Naira still needed to reach the minimum order, or null. */
      remainingForMinimum: number | null;
      estimatedMinutes: DeliveryEstimate | null;
      distanceMeters: number | null;
      /** True when this quote came from the legacy flat fee (schema absent). */
      legacy: boolean;
    }
  | {
      deliverable: false;
      reason: 'outside_area' | 'no_coordinates' | 'unavailable';
      message: string;
    };
