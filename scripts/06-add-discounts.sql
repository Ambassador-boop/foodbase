-- Add discount columns to menu_items table
ALTER TABLE menu_items
ADD COLUMN discount_type VARCHAR(50) DEFAULT NULL,
ADD COLUMN discount_value DECIMAL(10, 2) DEFAULT NULL,
ADD COLUMN discounted_price DECIMAL(10, 2) DEFAULT NULL;

-- Create index for discount_type to improve query performance
CREATE INDEX idx_menu_items_discount_type ON menu_items(discount_type);

-- Add comments for clarity
COMMENT ON COLUMN menu_items.discount_type IS 'Type of discount: percentage, fixed_amount, or NULL for no discount';
COMMENT ON COLUMN menu_items.discount_value IS 'Discount value: percentage (0-100) or fixed amount in currency';
COMMENT ON COLUMN menu_items.discounted_price IS 'Final price after discount (for reference, can be calculated dynamically)';
