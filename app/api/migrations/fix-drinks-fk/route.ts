import { query } from '@/lib/db';

export async function POST(request: Request) {
  try {
    console.log('[v0] Starting migration: fix order_items foreign key for drinks');

    // Step 1: Drop the existing foreign key constraint
    console.log('[v0] Step 1: Dropping existing foreign key constraint');
    try {
      await query(
        `ALTER TABLE order_items 
         DROP CONSTRAINT order_items_menu_item_id_fkey`
      );
      console.log('[v0] Foreign key constraint dropped successfully');
    } catch (err: any) {
      if (err.code === '42704') {
        // Constraint doesn't exist, which is fine
        console.log('[v0] Foreign key constraint does not exist, continuing');
      } else {
        throw err;
      }
    }

    // Step 2: Add item_type column if it doesn't exist
    console.log('[v0] Step 2: Adding item_type column');
    try {
      await query(
        `ALTER TABLE order_items 
         ADD COLUMN item_type VARCHAR(20) DEFAULT 'menu'`
      );
      console.log('[v0] item_type column added successfully');
    } catch (err: any) {
      if (err.code === '42701') {
        // Column already exists, which is fine
        console.log('[v0] item_type column already exists, continuing');
      } else {
        throw err;
      }
    }

    // Step 3: Migration complete - no foreign key constraint means we can store both menu items and drinks
    console.log('[v0] Migration completed successfully');
    console.log('[v0] order_items table now allows both menu_items and drinks in menu_item_id field');
    console.log('[v0] Use item_type column to distinguish between menu items and drinks');

    return Response.json({
      success: true,
      message: 'Migration completed successfully',
      details: [
        'Foreign key constraint on menu_item_id removed',
        'item_type column added to track whether item is menu or drink',
        'order_items table can now store references to both menu_items and drinks'
      ]
    });
  } catch (err) {
    console.error('[v0] Migration failed:', err);
    return Response.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
