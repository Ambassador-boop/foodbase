-- 100_normalize_order_items_price.sql
-- =====================================================================
-- Normalizes order_items.item_price so it stores ONLY the per-unit base
-- price of the menu item. Add-ons live in `configuration` (jsonb array)
-- and are added on at render / aggregation time.
--
-- BEFORE this migration the checkout page was inserting
--     item_price = basePrice + sum(addons.price)
-- and the receipt + dashboard renderers were ALSO summing the same add-ons
-- on top, producing inflated per-line totals (see screenshots).
--
-- This migration walks every order_items row, computes the per-unit
-- add-on total from `configuration`, and subtracts it from `item_price`.
-- The migration is idempotent: it tags the order in a guard table so it
-- only runs once. Re-running on a fresh DB is a no-op.
-- =====================================================================

CREATE TABLE IF NOT EXISTS order_items_price_migration (
  order_item_id varchar PRIMARY KEY,
  applied_at timestamp NOT NULL DEFAULT NOW()
);

WITH addon_totals AS (
  SELECT
    oi.id AS order_item_id,
    COALESCE(
      (
        SELECT SUM( COALESCE( (a->>'price')::numeric, 0 ) )
        FROM jsonb_array_elements(
               CASE
                 WHEN oi.configuration IS NULL THEN '[]'::jsonb
                 WHEN jsonb_typeof(oi.configuration) = 'array' THEN oi.configuration
                 ELSE '[]'::jsonb
               END
             ) AS a
      ),
      0
    ) AS per_unit_addon_total
  FROM order_items oi
  WHERE oi.id NOT IN (SELECT order_item_id FROM order_items_price_migration)
)
UPDATE order_items oi
SET item_price = GREATEST(0, COALESCE(oi.item_price, 0) - at.per_unit_addon_total)
FROM addon_totals at
WHERE oi.id = at.order_item_id
  AND at.per_unit_addon_total > 0;

INSERT INTO order_items_price_migration (order_item_id)
SELECT id FROM order_items
ON CONFLICT (order_item_id) DO NOTHING;

-- Sanity: print how many rows we touched
DO $$
DECLARE
  cnt INT;
BEGIN
  SELECT COUNT(*) INTO cnt FROM order_items_price_migration;
  RAISE NOTICE 'order_items rows tagged: %', cnt;
END $$;
