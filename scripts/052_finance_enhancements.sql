-- Finance enhancements: refund metadata, withdrawal timeline, recipient code alias
-- Idempotent migration. Safe to run multiple times.

-- 1. Refunds: add reason / notes / paystack metadata used by the request flow
ALTER TABLE refunds
  ADD COLUMN IF NOT EXISTS reason VARCHAR(64),
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS expected_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS deducted_amount NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS fully_deducted BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS channel VARCHAR(64),
  ADD COLUMN IF NOT EXISTS customer_note TEXT,
  ADD COLUMN IF NOT EXISTS merchant_note TEXT;

-- 2. Withdrawals: add daily withdrawal fee (₦500 for 4th+ same-day) and
--    paystack reference / gateway response for the timeline view
ALTER TABLE withdrawals
  ADD COLUMN IF NOT EXISTS withdrawal_fee NUMERIC(12, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reference VARCHAR(128),
  ADD COLUMN IF NOT EXISTS gateway_response TEXT,
  ADD COLUMN IF NOT EXISTS transfer_code VARCHAR(128),
  ADD COLUMN IF NOT EXISTS reason VARCHAR(255);

-- 3. Transfer recipients: legacy code/recipient_code alias for any older data
ALTER TABLE transfer_recipients
  ADD COLUMN IF NOT EXISTS recipient_code VARCHAR(128);

-- Backfill recipient_code from paystack_recipient_id where missing
UPDATE transfer_recipients
SET recipient_code = paystack_recipient_id
WHERE recipient_code IS NULL AND paystack_recipient_id IS NOT NULL;

-- 4. Indexes for finance page performance
CREATE INDEX IF NOT EXISTS idx_withdrawals_business_created
  ON withdrawals(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_refunds_business_created
  ON refunds(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_transactions_business_created
  ON transactions(business_id, created_at DESC);

-- 5. Drop the legacy 7.5% service_fee constraint if present (we no longer
--    deduct a percentage fee, only the flat ₦500 daily-overage fee)
-- service_fee column is kept for historical rows, but new rows write 0.
