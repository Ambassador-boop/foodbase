-- 101_finance_settlement.sql
-- =====================================================================
-- Adds the settlement state machine for business balances:
--   pending_balance  -> available_balance via a daily 05:00 WAT cron
--   Mon-Thu pay -> available next day 05:00 WAT
--   Fri / Sat / Sun pay -> available Monday 05:00 WAT
--
-- Existing transactions (already credited under the old flow) are
-- backfilled as `settled` so the new cron leaves them alone.
--
-- Also creates `finance_records` — a unified, append-only audit log that
-- powers /dashboard/finance Records (settlements, withdrawals, refunds,
-- and reversals all flow into one stream).
-- =====================================================================

-- ---- transactions ----------------------------------------------------
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS settlement_status varchar(16) NOT NULL DEFAULT 'settled',
  ADD COLUMN IF NOT EXISTS available_at      timestamp NULL,
  ADD COLUMN IF NOT EXISTS settled_at        timestamp NULL,
  ADD COLUMN IF NOT EXISTS balance_bucket    varchar(16) NOT NULL DEFAULT 'available';

CREATE INDEX IF NOT EXISTS idx_transactions_settlement_due
  ON transactions (settlement_status, available_at);

CREATE INDEX IF NOT EXISTS idx_transactions_business
  ON transactions (business_id, created_at DESC);

-- Backfill any pre-existing rows: anything already credited stays as
-- 'settled' / 'available' so the cron never moves them again.
UPDATE transactions
   SET settlement_status = 'settled',
       balance_bucket    = 'available',
       settled_at        = COALESCE(settled_at, created_at)
 WHERE settlement_status IS NULL
    OR settlement_status = '';

-- ---- refunds: track which bucket the refund deducted from -----------
ALTER TABLE refunds
  ADD COLUMN IF NOT EXISTS balance_affected varchar(16) NULL;
  -- 'pending' | 'available' | NULL (NULL = legacy / unknown)

-- ---- withdrawals: track if the deduction has been reversed ----------
ALTER TABLE withdrawals
  ADD COLUMN IF NOT EXISTS balance_reversed boolean NOT NULL DEFAULT false;

-- ---- finance_records (unified audit log) ----------------------------
CREATE TABLE IF NOT EXISTS finance_records (
  id              varchar PRIMARY KEY,
  business_id     varchar NOT NULL,
  record_type     varchar(24) NOT NULL,
  -- examples:
  --   'payment_pending'   (order paid, money sitting in pending_balance)
  --   'settlement'        (cron moved pending -> available)
  --   'withdrawal'        (funds debited from available)
  --   'withdrawal_reversed' (failed transfer returned to available)
  --   'refund'            (refund deducted from pending or available)
  --   'refund_reversed'   (failed refund restored to bucket)
  --   'recheck_credit'    (recheck found a pending Paystack tx successful)
  bucket          varchar(16) NULL,    -- 'pending' | 'available' | NULL
  direction       varchar(8)  NOT NULL,-- 'in' | 'out'
  amount          numeric NOT NULL,
  related_id      varchar NULL,        -- order_id / withdrawal_id / refund_id
  reference       varchar NULL,
  description     text NULL,
  created_at      timestamp NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_finance_records_business
  ON finance_records (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_finance_records_type
  ON finance_records (business_id, record_type, created_at DESC);
