-- ============================================================================
-- FoodBase — Batch 3B: delivery areas and table labels
--
-- Run this BEFORE merging Batch 3B. It is additive and idempotent:
--   * every statement is CREATE … IF NOT EXISTS or ADD COLUMN IF NOT EXISTS
--   * every new column is nullable or has a default
--   * no existing row is updated, and no column is dropped or renamed
--
-- The application behaves exactly as it does today if this file has NOT been
-- run: the delivery tables are detected at runtime, and orders fall back to the
-- old flat ₦1,000 fee with no table label.
--
-- Two blocks below:
--   1. REQUIRED  — schema for delivery areas, table labels and the additive
--                  order/business columns.
--   2. OPTIONAL  — gives every existing business one flat ₦1,000 area so its
--                  pricing does not change when the new code starts reading
--                  areas. Safe to skip; see the note at that block.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. REQUIRED
-- ----------------------------------------------------------------------------

-- Delivery areas ------------------------------------------------------------
-- One row per priced delivery zone. `area_sqm` is measured by the server when
-- the area is saved and is what "smallest matching area wins" sorts on, so two
-- overlapping zones always resolve the same way on every request.
CREATE TABLE IF NOT EXISTS delivery_areas (
  id                      text PRIMARY KEY,
  business_id             text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name                    text NOT NULL,
  area_type               text NOT NULL DEFAULT 'flat',
  fee                     numeric(12,2) NOT NULL DEFAULT 0,
  min_order               numeric(12,2),
  free_delivery_threshold numeric(12,2),
  is_active               boolean NOT NULL DEFAULT true,
  priority                integer NOT NULL DEFAULT 0,
  center_lat              double precision,
  center_lng              double precision,
  radius_m                integer,
  polygon                 jsonb,
  isochrone_minutes       integer,
  isochrone_profile       text,
  isochrone_geometry      jsonb,
  area_sqm                double precision,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS delivery_areas_business_active_idx
  ON delivery_areas (business_id, is_active);

-- Constraints are added in a DO block because Postgres has no
-- "ADD CONSTRAINT IF NOT EXISTS"; the guard keeps a re-run harmless.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'delivery_areas_area_type_check'
  ) THEN
    ALTER TABLE delivery_areas
      ADD CONSTRAINT delivery_areas_area_type_check
      CHECK (area_type IN ('flat', 'radius', 'polygon', 'isochrone'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'delivery_areas_fee_check'
  ) THEN
    ALTER TABLE delivery_areas
      ADD CONSTRAINT delivery_areas_fee_check CHECK (fee >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'delivery_areas_money_check'
  ) THEN
    ALTER TABLE delivery_areas
      ADD CONSTRAINT delivery_areas_money_check
      CHECK (
        (min_order IS NULL OR min_order >= 0)
        AND (free_delivery_threshold IS NULL OR free_delivery_threshold >= 0)
      );
  END IF;
END $$;

-- Table labels --------------------------------------------------------------
-- Strings, not integers: "Bar", "Patio 1" and "VIP" are real tables.
CREATE TABLE IF NOT EXISTS table_labels (
  id          text PRIMARY KEY,
  business_id text NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  label       text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS table_labels_business_order_idx
  ON table_labels (business_id, sort_order);

-- One live label per name per business, case-insensitively, so two tables
-- cannot both be called "5".
CREATE UNIQUE INDEX IF NOT EXISTS table_labels_business_label_uniq
  ON table_labels (business_id, lower(label));

-- Orders: additive, nullable ------------------------------------------------
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee              numeric(12,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_area_id          text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lat              double precision;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_lng              double precision;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_address_text     text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS estimated_delivery_minutes integer;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS table_label               text;

CREATE INDEX IF NOT EXISTS orders_delivery_area_idx ON orders (delivery_area_id);

-- Businesses: additive, nullable -------------------------------------------
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS prep_time_minutes integer;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS latitude          double precision;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS longitude         double precision;

COMMIT;

-- ============================================================================
-- 2. OPTIONAL — keep existing restaurants at today's ₦1,000
--
-- Without this block, a business with no active area charges NO delivery fee
-- once the code above is live (the decided behaviour for this batch). With it,
-- every business that has not configured an area yet gets one flat ₦1,000 area,
-- so nothing changes for them until they set their own prices.
--
-- Idempotent: it only inserts for businesses that have no area at all, so it can
-- be re-run safely and it will never overwrite a price someone set by hand.
--
-- Do not run this repeatedly after launch, or a brand-new restaurant that has
-- deliberately not configured delivery yet will silently get a ₦1,000 fee.
-- Run it once, now.
-- ============================================================================

-- BEGIN;
--
-- INSERT INTO delivery_areas
--   (id, business_id, name, area_type, fee, is_active, priority, area_sqm, created_at, updated_at)
-- SELECT
--   'da_legacy_' || substr(replace(b.id, '-', ''), 1, 14),
--   b.id,
--   'Standard delivery',
--   'flat',
--   1000.00,
--   true,
--   0,
--   NULL,
--   now(),
--   now()
-- FROM businesses b
-- WHERE NOT EXISTS (
--   SELECT 1 FROM delivery_areas da WHERE da.business_id = b.id
-- );
--
-- COMMIT;

-- ============================================================================
-- VERIFY (read-only)
-- ============================================================================
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'orders'
--    AND column_name IN ('delivery_fee','delivery_area_id','delivery_lat','delivery_lng',
--                        'delivery_address_text','estimated_delivery_minutes','table_label');
--
-- SELECT count(*) AS areas FROM delivery_areas;
-- SELECT count(*) AS labels FROM table_labels;
-- SELECT b.name, da.name AS area, da.area_type, da.fee
--   FROM businesses b LEFT JOIN delivery_areas da ON da.business_id = b.id
--  ORDER BY b.name;

-- ============================================================================
-- ROLLBACK (only if the batch is reverted; nothing depends on these while the
-- code is deployed, so the safe rollback is to leave the data in place)
-- ============================================================================
-- DROP TABLE IF EXISTS table_labels;
-- DROP TABLE IF EXISTS delivery_areas;
-- ALTER TABLE orders
--   DROP COLUMN IF EXISTS delivery_fee,
--   DROP COLUMN IF EXISTS delivery_area_id,
--   DROP COLUMN IF EXISTS delivery_lat,
--   DROP COLUMN IF EXISTS delivery_lng,
--   DROP COLUMN IF EXISTS delivery_address_text,
--   DROP COLUMN IF EXISTS estimated_delivery_minutes,
--   DROP COLUMN IF EXISTS table_label;
-- ALTER TABLE businesses
--   DROP COLUMN IF EXISTS prep_time_minutes,
--   DROP COLUMN IF EXISTS latitude,
--   DROP COLUMN IF EXISTS longitude;
