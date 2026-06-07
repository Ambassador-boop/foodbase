#!/usr/bin/env node
const { neon } = require('@neondatabase/serverless');

async function applyMigration() {
  if (!process.env.DATABASE_URL) {
    console.error('[v0] DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const sql = neon(process.env.DATABASE_URL);

  try {
    console.log('[v0] Starting migration: fix order_items foreign key for drinks');

    // Step 1: Drop the existing foreign key constraint
    console.log('[v0] Step 1: Dropping existing foreign key constraint');
    try {
      await sql(`ALTER TABLE order_items DROP CONSTRAINT order_items_menu_item_id_fkey`);
      console.log('[v0] ✓ Foreign key constraint dropped successfully');
    } catch (err) {
      if (err.code === '42704') {
        // Constraint doesn't exist, which is fine
        console.log('[v0] ✓ Foreign key constraint does not exist, continuing');
      } else if (err.detail && err.detail.includes('Cannot drop constraint')) {
        console.log('[v0] ✓ Constraint already removed or does not exist');
      } else {
        throw err;
      }
    }

    // Step 2: Add item_type column if it doesn't exist
    console.log('[v0] Step 2: Adding item_type column');
    try {
      await sql(`ALTER TABLE order_items ADD COLUMN item_type VARCHAR(20) DEFAULT 'menu'`);
      console.log('[v0] ✓ item_type column added successfully');
    } catch (err) {
      if (err.code === '42701') {
        // Column already exists, which is fine
        console.log('[v0] ✓ item_type column already exists');
      } else if (err.detail && err.detail.includes('already exists')) {
        console.log('[v0] ✓ Column already exists');
      } else {
        throw err;
      }
    }

    console.log('[v0] ✓ Migration completed successfully!');
    console.log('[v0] order_items table now allows both menu_items and drinks');
    console.log('[v0] Use item_type column to distinguish between menu items and drinks');
    
    process.exit(0);
  } catch (err) {
    console.error('[v0] ✗ Migration failed:', err.message);
    if (err.detail) console.error('[v0] Details:', err.detail);
    process.exit(1);
  }
}

applyMigration();
