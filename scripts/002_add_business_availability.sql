-- Add a nullable JSONB column for storing weekly availability / opening hours.
-- The shape is intentionally open for the future "availability" UI in the
-- business owner dashboard, e.g.:
-- {
--   "timezone": "Africa/Lagos",
--   "schedule": {
--     "mon": { "open": "09:00", "close": "21:00", "closed": false },
--     "tue": { "open": "09:00", "close": "21:00", "closed": false },
--     ...
--   },
--   "note": "Closed on public holidays"
-- }

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS availability JSONB;

-- Helpful index for any future text searches across the JSON document.
CREATE INDEX IF NOT EXISTS idx_businesses_availability
  ON businesses USING GIN (availability);
