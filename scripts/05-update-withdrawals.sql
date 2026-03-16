-- Update withdrawals table with additional fields for Paystack integration
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS paystack_transfer_id VARCHAR UNIQUE;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS service_fee NUMERIC DEFAULT 0;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS net_amount NUMERIC;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE withdrawals ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Create index for quick lookups
CREATE INDEX IF NOT EXISTS idx_withdrawals_business_id ON withdrawals(business_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);
CREATE INDEX IF NOT EXISTS idx_withdrawals_created_at ON withdrawals(created_at DESC);
