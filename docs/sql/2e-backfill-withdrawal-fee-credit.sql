-- ============================================================================
-- Batch 2e — Problem 1 BACKFILL: credit the missed withdrawal fees
-- ============================================================================
-- THIS SCRIPT MOVES MONEY (it credits admin revenue). Run
-- 2e-withdrawal-fee-credit.sql first. Read SECTION 0, run it alone, check the
-- rows and the total, then run SECTION 1.
--
-- SCOPE
--   Only withdrawals that are ALREADY successful and have a fee stored but not
--   yet credited. It never touches a pending, failed, reversed, abandoned,
--   blocked or rejected payout.
--
-- REQUIRED ORDER
--   1. docs/sql/2e-withdrawal-fee-credit.sql
--   2. SECTION 0 below (read-only preview)
--   3. SECTION 1 below (the credit) — safe to run more than once
--
-- IDEMPOTENT
--   It calls fb_record_withdrawal_fee row by row, which re-checks status, the
--   fee_credited flag and the 'wfe_<id>' ledger marker under a row lock. Running
--   this twice credits nothing the second time.
--
-- CONCURRENCY
--   Safe to run while the app is live: a webhook crediting the same withdrawal at
--   the same moment serialises on the same lock and the second caller reports
--   'already_credited'.
-- ============================================================================


-- ============================================================================
-- SECTION 0 — DRY RUN (read-only, changes nothing). Run this on its own first.
-- ============================================================================

-- 0.1 The exact rows that would be credited.
SELECT w.id                        AS withdrawal_id,
       w.business_id,
       b.name                      AS business_name,
       lower(w.status::text)       AS status,
       w.amount::numeric           AS amount,
       w.withdrawal_fee::numeric   AS fee_to_credit,
       w.processed_at,
       w.created_at,
       COALESCE(w.fee_credited, false) AS fee_credited_today,
       CASE WHEN EXISTS (SELECT 1 FROM admin_revenue_entries e WHERE e.id = 'wfe_' || w.id)
            THEN true ELSE false END   AS ledger_row_today
  FROM withdrawals w
  LEFT JOIN businesses b ON b.id = w.business_id
 WHERE lower(w.status::text) IN ('success', 'completed', 'processed')
   AND COALESCE(w.fee_credited, false) = false
   AND COALESCE(w.withdrawal_fee, 0) > 0
   AND NOT EXISTS (SELECT 1 FROM admin_revenue_entries e WHERE e.id = 'wfe_' || w.id)
 ORDER BY w.processed_at NULLS LAST, w.created_at;

-- 0.2 What it adds up to, and what it will change.
SELECT count(*)::int                              AS withdrawals_to_credit,
       COALESCE(sum(w.withdrawal_fee), 0)::numeric AS fees_to_credit,
       MIN(w.processed_at)                        AS first_payout,
       MAX(w.processed_at)                        AS last_payout
  FROM withdrawals w
 WHERE lower(w.status::text) IN ('success', 'completed', 'processed')
   AND COALESCE(w.fee_credited, false) = false
   AND COALESCE(w.withdrawal_fee, 0) > 0
   AND NOT EXISTS (SELECT 1 FROM admin_revenue_entries e WHERE e.id = 'wfe_' || w.id);

-- 0.3 The admin_revenue row that would move, before and after (no write).
SELECT r.id,
       COALESCE(r.total_revenue, 0)::numeric      AS total_revenue_before,
       COALESCE(r.available_balance, 0)::numeric  AS available_before,
       x.fees_to_credit,
       (COALESCE(r.total_revenue, 0) + COALESCE(x.fees_to_credit, 0))::numeric     AS total_revenue_after,
       (COALESCE(r.available_balance, 0) + COALESCE(x.fees_to_credit, 0))::numeric AS available_after
  FROM admin_revenue r
  CROSS JOIN (
    SELECT COALESCE(sum(w.withdrawal_fee), 0)::numeric AS fees_to_credit
      FROM withdrawals w
     WHERE lower(w.status::text) IN ('success', 'completed', 'processed')
       AND COALESCE(w.fee_credited, false) = false
       AND COALESCE(w.withdrawal_fee, 0) > 0
       AND NOT EXISTS (SELECT 1 FROM admin_revenue_entries e WHERE e.id = 'wfe_' || w.id)
  ) x
 ORDER BY r.updated_at NULLS LAST, r.id
 LIMIT 1;

-- EXPECTED (from the audit): 54 rows, fees_to_credit ~ 2000, and the 'after'
-- figures equal the 'before' figures plus that total.


-- ============================================================================
-- SECTION 1 — APPLY. Only run after reading SECTION 0.
-- ============================================================================
BEGIN;

DO $backfill$
DECLARE
  r          record;
  v_res      jsonb;
  v_credited integer := 0;
  v_skipped  integer := 0;
  v_failed   integer := 0;
  v_amount   numeric := 0;
  v_after    numeric;
BEGIN
  FOR r IN
    SELECT w.id, COALESCE(w.withdrawal_fee, 0)::numeric AS fee
      FROM withdrawals w
     WHERE lower(w.status::text) IN ('success', 'completed', 'processed')
       AND COALESCE(w.fee_credited, false) = false
       AND COALESCE(w.withdrawal_fee, 0) > 0
       AND NOT EXISTS (SELECT 1 FROM admin_revenue_entries e WHERE e.id = 'wfe_' || w.id)
     ORDER BY w.processed_at NULLS LAST, w.created_at
       FOR UPDATE OF w SKIP LOCKED
  LOOP
    BEGIN
      v_res := fb_record_withdrawal_fee(r.id);
      IF v_res ->> 'status' = 'credited' THEN
        v_credited := v_credited + 1;
        v_amount   := v_amount + COALESCE((v_res ->> 'fee')::numeric, r.fee);
      ELSIF v_res ->> 'status' = 'already_credited' THEN
        v_skipped := v_skipped + 1;
      ELSE
        v_failed := v_failed + 1;
        RAISE WARNING 'withdrawal % not credited: %', r.id, v_res;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      RAISE WARNING 'withdrawal % failed: %', r.id, SQLERRM;
    END;
  END LOOP;

  SELECT COALESCE(total_revenue, 0) INTO v_after
    FROM admin_revenue ORDER BY updated_at NULLS LAST, id LIMIT 1;

  RAISE NOTICE 'withdrawal fee backfill: credited %, skipped %, failed %, total credited %, admin_revenue.total_revenue now %',
    v_credited, v_skipped, v_failed, v_amount, v_after;
END
$backfill$;

-- Proof inside the same transaction: no successful withdrawal is left uncredited.
DO $check$
DECLARE
  v_left integer;
  v_sum  numeric;
BEGIN
  SELECT count(*), COALESCE(sum(withdrawal_fee), 0)
    INTO v_left, v_sum
    FROM withdrawals
   WHERE lower(status::text) IN ('success', 'completed', 'processed')
     AND COALESCE(fee_credited, false) = false
     AND COALESCE(withdrawal_fee, 0) > 0;
  IF v_left <> 0 THEN
    RAISE EXCEPTION 'backfill left % successful withdrawals uncredited (% naira); rolling back', v_left, v_sum;
  END IF;
  RAISE NOTICE 'verification passed: every successful withdrawal with a fee is credited';
END
$check$;

COMMIT;

-- Expected output: two NOTICE lines then COMMIT. Re-running the file reports
-- credited 0 because nothing is left to do.

-- If something looks wrong, roll back this backfill (only the credits made by
-- this batch, matched by the 'wfe_<id>' ledger marker):
--   docs/sql/2e-backfill-withdrawal-fee-credit-reverse.sql  (NOT provided here on
--   purpose: reversing revenue is a deliberate, per-row decision you should make
--   after reading the rows, not a script that ships in a batch).
