-- Add image_url to addons table
ALTER TABLE addons ADD COLUMN image_url VARCHAR(512);

-- Add is_available to addons table
ALTER TABLE addons ADD COLUMN is_available BOOLEAN DEFAULT true;

-- Verify the changes
SELECT column_name, data_type FROM information_schema.columns 
WHERE table_name = 'addons' ORDER BY ordinal_position;
