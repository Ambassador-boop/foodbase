-- Extend popular_dishes with merchandising columns so the page can
-- behave like a real "featured product" entry.

ALTER TABLE popular_dishes
  ADD COLUMN IF NOT EXISTS price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS original_price NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS is_available BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS tagline VARCHAR(160);

-- Make sure existing rows have sane defaults.
UPDATE popular_dishes SET is_available = TRUE WHERE is_available IS NULL;

-- Helpful index for the dashboard listing.
CREATE INDEX IF NOT EXISTS idx_popular_dishes_business
  ON popular_dishes (business_id, display_order, created_at DESC);
