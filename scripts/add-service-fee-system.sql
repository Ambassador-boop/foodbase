-- Add service_fee_amount to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_fee_amount NUMERIC DEFAULT 0;

-- Create service_fee_config table (admin configuration for tiered fees)
CREATE TABLE IF NOT EXISTS service_fee_config (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  tier_value INTEGER NOT NULL,
  service_fee INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tier_value)
);

-- Create order_service_fees table (track fee per order)
CREATE TABLE IF NOT EXISTS order_service_fees (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id VARCHAR(255) NOT NULL UNIQUE,
  service_fee_amount NUMERIC NOT NULL,
  service_fee_type VARCHAR(50) NOT NULL DEFAULT 'tiered',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);

-- Create admin_revenue table (track platform revenue)
CREATE TABLE IF NOT EXISTS admin_revenue (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  total_revenue NUMERIC DEFAULT 0,
  withdrawn_amount NUMERIC DEFAULT 0,
  available_balance NUMERIC DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create admin_bank_details table (store admin bank account)
CREATE TABLE IF NOT EXISTS admin_bank_details (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  bank_code VARCHAR(100) NOT NULL,
  account_number VARCHAR(100) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  paystack_recipient_id VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create admin_withdrawals table (track admin withdrawal requests)
CREATE TABLE IF NOT EXISTS admin_withdrawals (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  amount NUMERIC NOT NULL,
  bank_code VARCHAR(100) NOT NULL,
  account_number VARCHAR(100) NOT NULL,
  account_name VARCHAR(255) NOT NULL,
  paystack_transfer_id VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default service fee configuration
INSERT INTO service_fee_config (tier_value, service_fee) VALUES
(1000, 100),
(3000, 200),
(7000, 300),
(15000, 500),
(22000, 700),
(30000, 1000)
ON CONFLICT (tier_value) DO NOTHING;

-- Initialize admin_revenue if not exists
INSERT INTO admin_revenue (id, total_revenue, withdrawn_amount, available_balance)
SELECT 'admin-revenue-001', 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM admin_revenue LIMIT 1);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_order_service_fees_order_id ON order_service_fees(order_id);
CREATE INDEX IF NOT EXISTS idx_admin_withdrawals_status ON admin_withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_admin_withdrawals_created_at ON admin_withdrawals(created_at);
