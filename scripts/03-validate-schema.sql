-- Schema Validation Script for FoodBase
-- Run this after migrations to verify database structure

-- Check Users table
SELECT 
  'users' as table_name,
  COUNT(*) as row_count,
  MAX(created_at) as latest_user
FROM users;

-- Check Users table columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Verify admin user exists
SELECT id, email, role, first_name, last_name, phone, is_active
FROM users
WHERE email = 'wisdommeremeze@gmail.com';

-- Verify business owner user exists
SELECT id, email, role, first_name, last_name, phone, is_active
FROM users
WHERE email = 'owner@example.com';

-- Check Businesses table
SELECT 
  'businesses' as table_name,
  COUNT(*) as business_count
FROM businesses;

-- Verify business details
SELECT 
  id, name, slug, owner_id, phone, email, 
  bank_account_holder, bank_account_number, bank_code,
  available_balance, pending_balance
FROM businesses
WHERE slug = 'the-golden-fork';

-- Check Categories table
SELECT id, business_id, name, display_order
FROM categories
WHERE display_order = 1
LIMIT 5;

-- Check Menu Items table
SELECT id, business_id, category_id, name, price, is_available
FROM menu_items
LIMIT 5;

-- Check Addons table structure
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'addons'
ORDER BY ordinal_position;

-- Verify addons data
SELECT id, business_id, addon_type, name, is_required, allow_multiple
FROM addons
LIMIT 5;

-- Check Addon Options
SELECT id, addon_id, name, price, display_order
FROM addon_options
LIMIT 5;

-- Count all tables
SELECT 
  schemaname,
  COUNT(*) as table_count
FROM pg_tables
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
GROUP BY schemaname;

-- List all tables
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Validate that password hashes are not null and properly formatted
SELECT 
  id, email, 
  LENGTH(password_hash) as hash_length,
  SUBSTRING(password_hash, 1, 4) as hash_prefix
FROM users
WHERE password_hash IS NOT NULL;
