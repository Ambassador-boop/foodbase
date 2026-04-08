-- Create color_configurations table for storing page color customizations
CREATE TABLE IF NOT EXISTS color_configurations (
  id CHARACTER VARYING PRIMARY KEY,
  business_id CHARACTER VARYING NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  page_type CHARACTER VARYING NOT NULL, -- 'menu', 'add_on', 'cart', 'checkout', 'receipt'
  background_color CHARACTER VARYING,
  text_color CHARACTER VARYING,
  button_color CHARACTER VARYING,
  button_text_color CHARACTER VARYING,
  header_color CHARACTER VARYING,
  header_text_color CHARACTER VARYING,
  accent_color CHARACTER VARYING,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(business_id, page_type)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_color_config_business_page 
ON color_configurations(business_id, page_type);
