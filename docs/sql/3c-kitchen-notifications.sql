-- ============================================================================
-- FoodBase — Batch 3C: kitchen display, and one paid-order alert
--
-- Run this BEFORE merging Batch 3C. It is additive and idempotent:
--   * every statement is ADD COLUMN IF NOT EXISTS / CREATE INDEX IF NOT EXISTS
--   * every new column is nullable, with no default that rewrites existing rows
--   * nothing is dropped, renamed or retyped
--
-- The application behaves correctly if this file has NOT been run:
--   * the kitchen board falls back to `updated_at`/`created_at` for elapsed time,
--     hides the prep estimate, and keeps ready tickets on the pass until this
--     device has watched them for the configured hold time;
--   * the paid-order alert falls back to a claim row in `notifications`, keyed on
--     the table's existing UNIQUE `onesignal_notification_id`.
-- Running it upgrades both paths to their intended, durable form.
--
-- Why each statement exists is written next to it. No statement here touches
-- payments, refunds, withdrawals, settlement, PINs or auth.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. REQUIRED — exactly-once "this order is paid" alert
-- ----------------------------------------------------------------------------

-- Set once, by the single caller that wins the claim:
--   UPDATE orders SET restaurant_notified_at = NOW()
--    WHERE id = $1 AND restaurant_notified_at IS NULL
--      AND payment_status IN ('paid', 'completed')
--   RETURNING id;
-- NULL means "not announced yet". Verify and the Paystack webhook both attempt
-- the update; only one can see the row, so only one sends the push.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS restaurant_notified_at timestamptz;

COMMENT ON COLUMN orders.restaurant_notified_at IS
  'When the restaurant was told this order is paid. NULL = not announced. Claimed by a single guarded UPDATE.';

-- The kitchen board reads: business_id + one of three statuses, paid only.
-- A partial index keeps that read cheap without touching the other order queries.
CREATE INDEX IF NOT EXISTS orders_kitchen_board_idx
  ON orders (business_id, status)
  WHERE payment_status IN ('paid', 'completed');

-- ----------------------------------------------------------------------------
-- 2. OPTIONAL — kitchen detail columns
-- ----------------------------------------------------------------------------

-- The prep estimate a cook picks on the ticket (10 / 15 / 20 / 30 minutes).
-- Used only to show "Est. 15 min" and "3 min over" on the card.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kitchen_prep_minutes integer;

-- When the pass marked the order ready. Gives the "average to ready" figure a
-- true start-to-finish interval instead of falling back to `completed_at`.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kitchen_ready_at timestamptz;

-- Keep the estimate sane without ever rejecting an existing row: the guard only
-- constrains new writes, and a NULL estimate is always allowed.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_kitchen_prep_minutes_range'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_kitchen_prep_minutes_range
      CHECK (kitchen_prep_minutes IS NULL OR (kitchen_prep_minutes >= 1 AND kitchen_prep_minutes <= 240));
  END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 3. OPTIONAL — do not announce history
-- ----------------------------------------------------------------------------
-- Without this block, every order already paid before the deploy has
-- restaurant_notified_at = NULL. A late Paystack webhook replay for one of those
-- orders would then send an owner a "new paid order" push for a meal served last
-- week. Sealing them now is the safer default.
--
-- Guarded on the existence of `paid_at`, because the column is created by the
-- settlement function on some deployments and not on others.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'paid_at'
  ) THEN
    UPDATE orders
       SET restaurant_notified_at = COALESCE(paid_at, updated_at, created_at)
     WHERE restaurant_notified_at IS NULL
       AND payment_status IN ('paid', 'completed');
  ELSE
    UPDATE orders
       SET restaurant_notified_at = COALESCE(updated_at, created_at)
     WHERE restaurant_notified_at IS NULL
       AND payment_status IN ('paid', 'completed');
  END IF;
END $$;

COMMIT;

-- ============================================================================
-- Verify (run after committing; read-only)
-- ============================================================================
-- 1. The columns exist:
--    SELECT column_name, data_type, is_nullable
--      FROM information_schema.columns
--     WHERE table_name = 'orders'
--       AND column_name IN ('restaurant_notified_at','kitchen_prep_minutes','kitchen_ready_at')
--     ORDER BY column_name;
--
-- 2. The index exists:
--    SELECT indexname FROM pg_indexes WHERE tablename = 'orders' AND indexname = 'orders_kitchen_board_idx';
--
-- 3. Nothing paid is left unclaimed (expect 0):
--    SELECT count(*) FROM orders
--     WHERE payment_status IN ('paid','completed') AND restaurant_notified_at IS NULL;
--
-- 4. The kitchen board's own query, unaliased by the app:
--    SELECT id, status, kitchen_prep_minutes, kitchen_ready_at
--      FROM orders
--     WHERE business_id = '<a business id>'
--       AND payment_status IN ('paid','completed')
--       AND status::text IN ('pending','preparing','ready')
--     ORDER BY COALESCE(paid_at, updated_at, created_at);
--
-- ============================================================================
-- Rollback (only if Batch 3C is reverted; nothing else reads these)
-- ============================================================================
-- BEGIN;
--   DROP INDEX IF EXISTS orders_kitchen_board_idx;
--   ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_kitchen_prep_minutes_range;
--   ALTER TABLE orders DROP COLUMN IF EXISTS kitchen_ready_at;
--   ALTER TABLE orders DROP COLUMN IF EXISTS kitchen_prep_minutes;
--   ALTER TABLE orders DROP COLUMN IF EXISTS restaurant_notified_at;
-- COMMIT;
