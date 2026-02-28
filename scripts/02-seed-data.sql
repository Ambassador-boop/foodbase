-- Seed data for FoodBase development
-- Admin credentials: wisdommeremeze@gmail.com / 1a2B3c$d
-- Note: Hash was generated using bcryptjs with cost factor 10

-- Insert test admin user
INSERT INTO users (id, email, password_hash, role, first_name, last_name, phone, is_active, created_at, updated_at)
VALUES ('adm_' || gen_random_uuid()::text, 'wisdommeremeze@gmail.com', '$2b$10$nQTWwdBfn.cZqmqLfKjg3uoEk5q5nD7V9i2L5j9R7e4M8x3F2H9Ky', 'admin', 'Wisdom', 'Admin', '08000000000', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Insert test business owner
INSERT INTO users (id, email, password_hash, role, first_name, last_name, phone, is_active, created_at, updated_at)
VALUES ('usr_' || gen_random_uuid()::text, 'owner@example.com', '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcg7b3XeKeUxWdeS86E36P4/1Fm', 'business_owner', 'John', 'Okafor', '08012345678', true, NOW(), NOW())
ON CONFLICT DO NOTHING;

-- Insert test business
INSERT INTO businesses (id, owner_id, name, slug, description, image_url, logo_url, phone, email, address, city, state, country, created_at)
SELECT 'biz_' || gen_random_uuid()::text, id, 'The Golden Fork', 'the-golden-fork', 'Modern restaurant with authentic cuisines', '/business-image.jpg', '/foodbase-logo.png', '08012345678', 'owner@example.com', '123 Main Street', 'Lagos', 'Lagos', 'Nigeria', NOW()
FROM users WHERE email = 'owner@example.com' AND role = 'business_owner'
ON CONFLICT DO NOTHING;

-- Insert test categories
INSERT INTO categories (id, business_id, name, description, display_order, created_at)
SELECT 'cat_' || gen_random_uuid()::text, id, 'Main Dishes', 'Our signature main courses', 1, NOW()
FROM businesses WHERE slug = 'the-golden-fork'
ON CONFLICT DO NOTHING;

-- Insert test menu items
INSERT INTO menu_items (id, business_id, category_id, name, description, price, image_url, is_available, created_at)
SELECT 
  'itm_' || gen_random_uuid()::text,
  b.id,
  c.id,
  'Jollof Rice with Chicken',
  'Aromatic jollof rice served with grilled chicken',
  2500,
  '/menu-items/jollof.jpg',
  true,
  NOW()
FROM businesses b
JOIN categories c ON b.id = c.business_id
WHERE b.slug = 'the-golden-fork'
ON CONFLICT DO NOTHING;

-- Insert test add-ons
INSERT INTO addons (id, business_id, addon_type, name, description, display_order, is_required, allow_multiple, created_at, updated_at)
SELECT 
  'add_' || gen_random_uuid()::text,
  id,
  'Proteins',
  'Extra Chicken',
  'Add extra chicken to your meal',
  1,
  false,
  true,
  NOW(),
  NOW()
FROM businesses WHERE slug = 'the-golden-fork'
ON CONFLICT DO NOTHING;

-- Insert addon options
INSERT INTO addon_options (id, addon_id, name, price, display_order, created_at)
SELECT 
  'opt_' || gen_random_uuid()::text,
  a.id,
  'Chicken Breast',
  500,
  1,
  NOW()
FROM addons a
JOIN businesses b ON a.business_id = b.id
WHERE b.slug = 'the-golden-fork' AND a.addon_type = 'Proteins'
ON CONFLICT DO NOTHING;

-- Add business bank details
UPDATE businesses 
SET 
  bank_account_holder = 'John Okafor',
  bank_account_number = '1234567890',
  bank_code = '044',
  postal_code = '100001',
  available_balance = 0.00,
  pending_balance = 0.00,
  total_orders = 0,
  is_active = true,
  updated_at = NOW()
WHERE slug = 'the-golden-fork';
