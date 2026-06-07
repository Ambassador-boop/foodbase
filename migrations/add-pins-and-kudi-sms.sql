-- Create pins table for storing temporary PINs
CREATE TABLE IF NOT EXISTS pins (
  id VARCHAR(64) PRIMARY KEY,
  business_id VARCHAR(64) NOT NULL,
  pin_hash VARCHAR(255) NOT NULL,
  purpose VARCHAR(50) NOT NULL, -- 'bank_account' or 'withdrawal'
  metadata JSONB, -- stores bank details or withdrawal amount
  expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  INDEX idx_business_id (business_id),
  INDEX idx_expires_at (expires_at)
);

-- Create kudi_sms_balance table for tracking SMS balance
CREATE TABLE IF NOT EXISTS kudi_sms_balance (
  id VARCHAR(64) PRIMARY KEY,
  balance NUMERIC(12, 2) NOT NULL,
  last_updated TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_last_updated (last_updated)
);

-- Create kudi_sms_logs table for auditing SMS sends
CREATE TABLE IF NOT EXISTS kudi_sms_logs (
  id VARCHAR(64) PRIMARY KEY,
  business_id VARCHAR(64) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  message TEXT NOT NULL,
  purpose VARCHAR(50) NOT NULL, -- 'bank_account' or 'withdrawal'
  kudi_message_id VARCHAR(100),
  status VARCHAR(50) NOT NULL DEFAULT 'sent', -- 'sent', 'failed', 'bounced'
  error_code VARCHAR(10),
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
  INDEX idx_business_id (business_id),
  INDEX idx_created_at (created_at),
  INDEX idx_status (status)
);
