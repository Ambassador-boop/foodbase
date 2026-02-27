-- FoodBase Database Schema
-- Multi-tenant restaurant ordering SaaS with alphanumeric IDs

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create ENUM types
CREATE TYPE user_role AS ENUM ('admin', 'business_owner');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled');
CREATE TYPE withdrawal_status AS ENUM ('pending', 'approved', 'rejected', 'completed');

-- Users table
CREATE TABLE users (
  id VARCHAR(21) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'business_owner',
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Businesses table
CREATE TABLE businesses (
  id VARCHAR(21) PRIMARY KEY,
  owner_id VARCHAR(21) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  logo_url VARCHAR(512),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  address VARCHAR(500),
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  postal_code VARCHAR(20),
  bank_account_holder VARCHAR(255),
  bank_account_number VARCHAR(50),
  bank_code VARCHAR(10),
  available_balance DECIMAL(12, 2) DEFAULT 0,
  pending_balance DECIMAL(12, 2) DEFAULT 0,
  total_orders INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Password reset OTP table
CREATE TABLE password_reset_otps (
  id VARCHAR(21) PRIMARY KEY,
  user_id VARCHAR(21) NOT NULL,
  email VARCHAR(255) NOT NULL,
  otp_code VARCHAR(6) NOT NULL,
  is_verified BOOLEAN DEFAULT false,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Categories table
CREATE TABLE categories (
  id VARCHAR(21) PRIMARY KEY,
  business_id VARCHAR(21) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Menu items (main dishes) table
CREATE TABLE menu_items (
  id VARCHAR(21) PRIMARY KEY,
  business_id VARCHAR(21) NOT NULL,
  category_id VARCHAR(21),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url VARCHAR(512),
  is_available BOOLEAN DEFAULT true,
  is_popular BOOLEAN DEFAULT false,
  order_count INT DEFAULT 0,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Add-ons (proteins, sides, toppings) table
CREATE TABLE addons (
  id VARCHAR(21) PRIMARY KEY,
  business_id VARCHAR(21) NOT NULL,
  name VARCHAR(255) NOT NULL,
  addon_type VARCHAR(50) NOT NULL,
  description TEXT,
  is_required BOOLEAN DEFAULT false,
  allow_multiple BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Addon options (e.g., chicken, beef, fish for protein addon)
CREATE TABLE addon_options (
  id VARCHAR(21) PRIMARY KEY,
  addon_id VARCHAR(21) NOT NULL,
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) DEFAULT 0,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (addon_id) REFERENCES addons(id) ON DELETE CASCADE
);

-- Menu item addon associations
CREATE TABLE menu_item_addons (
  id VARCHAR(21) PRIMARY KEY,
  menu_item_id VARCHAR(21) NOT NULL,
  addon_id VARCHAR(21) NOT NULL,
  is_required BOOLEAN DEFAULT false,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  FOREIGN KEY (addon_id) REFERENCES addons(id) ON DELETE CASCADE
);

-- Drinks table
CREATE TABLE drinks (
  id VARCHAR(21) PRIMARY KEY,
  business_id VARCHAR(21) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url VARCHAR(512),
  is_available BOOLEAN DEFAULT true,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Popular dishes (curated) table
CREATE TABLE popular_dishes (
  id VARCHAR(21) PRIMARY KEY,
  business_id VARCHAR(21) NOT NULL,
  menu_item_ids VARCHAR(255),
  featured_image_url VARCHAR(512),
  combination_name VARCHAR(255),
  description TEXT,
  order_count INT DEFAULT 0,
  is_manual BOOLEAN DEFAULT false,
  display_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Orders table
CREATE TABLE orders (
  id VARCHAR(21) PRIMARY KEY,
  business_id VARCHAR(21) NOT NULL,
  customer_email VARCHAR(255) NOT NULL,
  customer_name VARCHAR(255),
  customer_phone VARCHAR(20),
  status order_status DEFAULT 'pending',
  total_amount DECIMAL(12, 2) NOT NULL,
  payment_reference VARCHAR(255),
  payment_status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Order items (dishes with selected add-ons)
CREATE TABLE order_items (
  id VARCHAR(21) PRIMARY KEY,
  order_id VARCHAR(21) NOT NULL,
  menu_item_id VARCHAR(21) NOT NULL,
  quantity INT DEFAULT 1,
  item_price DECIMAL(10, 2) NOT NULL,
  configuration JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE RESTRICT
);

-- Transactions (revenue tracking)
CREATE TABLE transactions (
  id VARCHAR(21) PRIMARY KEY,
  business_id VARCHAR(21) NOT NULL,
  order_id VARCHAR(21),
  amount DECIMAL(12, 2) NOT NULL,
  transaction_type VARCHAR(50) NOT NULL,
  payment_method VARCHAR(50),
  payment_reference VARCHAR(255),
  status VARCHAR(50) DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
);

-- Withdrawals table
CREATE TABLE withdrawals (
  id VARCHAR(21) PRIMARY KEY,
  business_id VARCHAR(21) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  status withdrawal_status DEFAULT 'pending',
  bank_account_holder VARCHAR(255),
  bank_account_number VARCHAR(50),
  bank_code VARCHAR(10),
  payment_reference VARCHAR(255),
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,
  notes TEXT,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Analytics table
CREATE TABLE analytics (
  id VARCHAR(21) PRIMARY KEY,
  business_id VARCHAR(21) NOT NULL,
  date DATE NOT NULL,
  total_orders INT DEFAULT 0,
  total_revenue DECIMAL(12, 2) DEFAULT 0,
  unique_customers INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  UNIQUE(business_id, date)
);

-- Create indexes for performance
CREATE INDEX idx_businesses_owner_id ON businesses(owner_id);
CREATE INDEX idx_businesses_slug ON businesses(slug);
CREATE INDEX idx_categories_business_id ON categories(business_id);
CREATE INDEX idx_menu_items_business_id ON menu_items(business_id);
CREATE INDEX idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX idx_addons_business_id ON addons(business_id);
CREATE INDEX idx_addon_options_addon_id ON addon_options(addon_id);
CREATE INDEX idx_drinks_business_id ON drinks(business_id);
CREATE INDEX idx_popular_dishes_business_id ON popular_dishes(business_id);
CREATE INDEX idx_orders_business_id ON orders(business_id);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_transactions_business_id ON transactions(business_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_withdrawals_business_id ON withdrawals(business_id);
CREATE INDEX idx_analytics_business_id ON analytics(business_id);
CREATE INDEX idx_analytics_date ON analytics(date);
CREATE INDEX idx_password_reset_otps_user_id ON password_reset_otps(user_id);
