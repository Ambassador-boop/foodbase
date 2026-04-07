-- Add original_price column to menu_items table
ALTER TABLE menu_items
ADD COLUMN original_price NUMERIC DEFAULT NULL;

-- Update original_price to match current price for all existing items
UPDATE menu_items 
SET original_price = price 
WHERE original_price IS NULL;

-- Comment for clarity
COMMENT ON COLUMN menu_items.original_price IS 'Original price before discount (used to show strike-through)';
COMMENT ON COLUMN menu_items.discount_type IS 'Type of discount: percentage, fixed_amount, or NULL for no discount';
COMMENT ON COLUMN menu_items.discount_value IS 'Discount value: percentage (0-100) or fixed amount in currency';
