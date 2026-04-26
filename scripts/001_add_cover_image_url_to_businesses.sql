-- Add cover_image_url column to businesses table
-- This column stores the URL of the cover image displayed at the top
-- of the restaurant menu page (e.g. /[slug])

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS cover_image_url VARCHAR(500);
