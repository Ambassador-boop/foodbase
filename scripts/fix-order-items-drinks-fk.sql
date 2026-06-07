-- Migration: Fix order_items foreign key to support drinks
-- This migration allows order_items to reference both menu_items and drinks

-- Step 1: Drop the existing foreign key constraint
ALTER TABLE order_items 
DROP CONSTRAINT order_items_menu_item_id_fkey;

-- Step 2: Add item_type column to track whether it's a menu item or drink
ALTER TABLE order_items 
ADD COLUMN item_type VARCHAR(20) DEFAULT 'menu';

-- Step 3: Recreate the foreign key as optional (allow NULL)
ALTER TABLE order_items 
ADD CONSTRAINT order_items_menu_item_id_fkey 
FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE RESTRICT;

-- Step 4: Drop the constraint again and recreate without FK
-- This allows menu_item_id to be flexible for both menu items and drinks
ALTER TABLE order_items 
DROP CONSTRAINT order_items_menu_item_id_fkey;

-- Note: The order_items table now has:
-- - id: order item unique identifier
-- - order_id: references orders
-- - menu_item_id: stores either menu item ID or drink ID
-- - item_type: indicates whether it's 'menu' or 'drink'
-- - quantity, item_price, configuration: order details
-- This allows flexible storage of both menu items and drinks
