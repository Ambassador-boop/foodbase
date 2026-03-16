-- Create transfer_recipients table for Paystack withdrawal setup
CREATE TABLE transfer_recipients (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  business_id VARCHAR NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  paystack_recipient_id VARCHAR UNIQUE NOT NULL,
  bank_code VARCHAR NOT NULL,
  account_number VARCHAR NOT NULL,
  account_name VARCHAR NOT NULL,
  account_type VARCHAR DEFAULT 'nuban',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transfer_recipients_business_id ON transfer_recipients(business_id);
CREATE INDEX idx_transfer_recipients_active ON transfer_recipients(is_active);
