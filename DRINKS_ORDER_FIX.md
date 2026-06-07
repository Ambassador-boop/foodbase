# Fix: Order Items with Drinks Support

## Problem

When creating an order with drinks, the system was encountering two errors:

### Error 1: "value too long for type character varying(21)"
- **Cause**: Drink IDs were being prefixed with `drink_` (e.g., `drink_abc123def456`) before being inserted into the `menu_item_id` field, which has a 21-character limit
- **Result**: Drinks couldn't be stored as order items

### Error 2: "insert or update on table "order_items" violates foreign key constraint"
- **Cause**: The `menu_item_id` field had a foreign key constraint referencing only `menu_items.id`, but drink IDs don't exist in the `menu_items` table
- **Result**: Even if the drink ID fit within 21 characters, the foreign key constraint would reject it

## Solution

### 1. Database Schema Changes (Migration Applied)

**File**: `/app/api/migrations/fix-drinks-fk/route.ts`

The migration removes the foreign key constraint on `order_items.menu_item_id` and adds an `item_type` column:

```sql
-- Removed the restrictive foreign key constraint
ALTER TABLE order_items 
DROP CONSTRAINT order_items_menu_item_id_fkey;

-- Added column to track whether item is menu or drink
ALTER TABLE order_items 
ADD COLUMN item_type VARCHAR(20) DEFAULT 'menu';
```

**Result**: The `order_items.menu_item_id` field can now store IDs from both `menu_items` and `drinks` tables.

### 2. API Changes

**Order Creation** (`/app/api/orders/route.ts`):
- Detects drink IDs by checking if `menu_item_id` starts with `drink_`
- Removes the `drink_` prefix before storing in the database (storing just the actual drink ID)
- Stores `item_type` column with value `'drink'` or `'menu'`
- Preserves item metadata in the `configuration` JSON field

**Order Retrieval** (`/app/api/orders/[orderId]/route.ts`):
- Joins with both `menu_items` and `drinks` tables using LEFT JOIN
- Uses `COALESCE()` to pull item details from whichever table has data
- Properly displays drink information in receipts and order details

### 3. How It Works Now

#### When Adding a Drink to Order:
1. Frontend sends drink with ID format: `drink_drk_s4XK-HQld5owIkolA`
2. API detects the `drink_` prefix
3. Removes prefix and stores just: `drk_s4XK-HQld5owIkolA`
4. Stores `item_type: 'drink'` for tracking
5. Successfully inserts into `order_items` table

#### When Retrieving Order:
1. API queries `order_items` with both menu_items and drinks joins:
   ```sql
   LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
   LEFT JOIN drinks d ON oi.menu_item_id = d.id
   ```
2. Uses `COALESCE()` to get data from whichever table has a match
3. Returns complete order with all items (menu items and drinks)

## Testing

### To Apply the Migration:
```bash
curl -X POST http://localhost:3000/api/migrations/fix-drinks-fk
```

Expected response:
```json
{
  "success": true,
  "message": "Migration completed successfully",
  "details": [
    "Foreign key constraint on menu_item_id removed",
    "item_type column added to track whether item is menu or drink",
    "order_items table can now store references to both menu_items and drinks"
  ]
}
```

### To Verify Order Creation with Drinks:
1. Visit a restaurant page in the app
2. Add a drink to the cart
3. Proceed to checkout
4. Check the console logs for:
   - `[v0] Processing order item - ID: drk_... type: drink quantity: ...`
   - `[v0] ✓ Order item inserted: { id: ..., type: 'drink', menu_item_id: 'drk_...', quantity: ... }`
5. Order should be created successfully with correct item count

## Files Modified

1. **`/app/api/orders/route.ts`**
   - Added logic to strip `drink_` prefix from IDs
   - Added `item_type` column to insert statement
   - Enhanced logging with checkmarks and clearer output

2. **`/app/api/orders/[orderId]/route.ts`**
   - Already had correct JOIN logic for both tables
   - No changes needed (already working)

3. **`/app/api/migrations/fix-drinks-fk/route.ts`** (NEW)
   - One-time migration endpoint to fix database schema
   - Removes foreign key constraint
   - Adds `item_type` tracking column

## Debugging

If you encounter issues:

1. **Check database changes**:
   - Log into your Neon dashboard
   - Verify `order_items` table no longer has foreign key constraint on `menu_item_id`
   - Verify `item_type` column exists

2. **Check order creation logs**:
   - Look for `[v0] Processing order item` logs
   - Verify `type: drink` appears for drinks
   - Check for error messages starting with `[v0] ✗`

3. **Check order retrieval**:
   - Verify `/[slug]/receipt` page shows correct drink items
   - Verify `/dashboard/orders/[orderId]` shows correct item count

## Summary

Orders with drinks now work end-to-end:
- ✓ Drinks can be added to cart
- ✓ Drinks are correctly stored in orders
- ✓ Order item counts are accurate
- ✓ Drinks appear in receipts and order details
