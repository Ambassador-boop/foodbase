-- ============================================================================
-- Batch 2e — Problem 2 BACKFILL: record Paystack payout fees on the 54 payouts
-- ============================================================================
-- THIS SCRIPT MOVES MONEY (it lowers available_balance and raises
-- expenses_amount). Run 2e-withdrawal-provider-fee.sql first. Read SECTION 0,
-- run it alone, check the rows and the total, then run SECTION 1.
--
-- SCOPE
--   Successful withdrawals only, with no fee recorded yet. Failed, reversed,
--   pending and every other status is skipped by the function itself.
--
-- FEE SOURCE
--   Paystack does not return a fee on a transfer object, so the figure is
--   computed from lib/paystack-fees.ts and stored with source 'computed':
--        amount <= 5,000            -> 10
--        5,001 .. 50,000            -> 25
--        above 50,000               -> 50
--      + 50 stamp duty when amount >= 10,000
--   That is the same arithmetic as transferFeeBreakdown() in that file.
--
-- REQUIRED ORDER
--   1. docs/sql/2e-withdrawal-provider-fee.sql
--   2. SECTION 0 below (read-only preview)
--   3. SECTION 1 below (the write) — safe to run more than once
--
-- IDEMPOTENT: it calls fb_admin_record_withdrawal_provider_fee, which re-checks
-- status, withdrawals.provider_fee and the 'wfee_<id>' ledger marker under a row
-- lock. A second run records nothing.
-- ============================================================================


-- ============================================================================
-- SECTION 0 — DRY RUN (read-only, changes nothing). Run this on its own first.
-- ============================================================================

-- 0.1 The exact rows that would be recorded, with the fee it would compute.
SELECT w.id                          AS withdrawal_id,
       w.business_id,
       b.name                        AS business_name,
       lower(w.status::text)         AS status,
       w.amount::numeric             AS amount,
       (CASE WHEN w.amount <= 5000  THEN 10
             WHEN w.amount <= 50000 THEN 25
             ELSE 50 END)::numeric   AS transfer_fee,
       (CASE WHEN w.amount >= 10000 THEN 50 ELSE 0 END)::numeric AS stamp_duty,
       ((CASE WHEN w.amount <= 5000  THEN 10
              WHEN w.amount <= 50000 THEN 25
              ELSE 50 END)
        + (CASE WHEN w.amount >= 10000 THEN 50 ELSE 0 END))::numeric AS fee_to_record,
       w.processed_at,
       w.created_at,
       COALESCE(w.provider_fee, 0)::numeric AS provider_fee_today,
       CASE WHEN EXISTS (SELECT 1 FROM admin_revenue_entries e WHERE e.id = 'wfee_' || w.id)
            THEN true ELSE false END AS ledger_row_today
  FROM withdrawals w
  LEFT JOIN businesses b ON b.id = w.business_id
 WHERE lower(w.status::text) IN ('success', 'completed', 'processed')
   AND COALESCE(w.provider_fee, 0) = 0
   AND NOT EXISTS (SELECT 1 FROM admin_revenue_entries e WHERE e.id = 'wfee_' || w.id)
 ORDER BY w.processed_at NULLS LAST, w.created_at;

-- 0.2 What it adds up to, and what it changes.
SELECT count(*)::int AS withdrawals_to_record,
       COALESCE(sum(
         (CASE WHEN w.amount <= 5000  THEN 10
               WHEN w.amount <= 50000 THEN 25
               ELSE 50 END)
         + (CASE WHEN w.amount >= 10000 THEN 50 ELSE 0 END)
       ), 0)::numeric AS fees_to_record,
       count(*) FILTER (WHERE w.amount >= 10000)::int AS rows_with_stamp_duty,
       MIN(w.processed_at) AS first_payout,
       MAX(w.processed_at) AS last_payout
  FROM withdrawals w
 WHERE lower(w.status::text) IN ('success', 'completed', 'processed')
   AND COALESCE(w.provider_fee, 0) = 0
   AND NOT EXISTS (SELECT 1 FROM admin_revenue_entries e WHERE e.id = 'wfee_' || w.id);

-- 0.3 The admin_revenue row that would move, before and after (no write).
SELECT r.id,
       COALESCE(r.available_balance, 0)::numeric AS available_before,
       x.fees_to_record,
       (COALESCE(r.available_balance, 0) - COALESCE(x.fees_to_record, 0))::numeric AS available_after
  FROM admin_revenue r
  CROSS JOIN (
    SELECT COALESCE(sum(
             (CASE WHEN w.amount <= 5000  THEN 10
                   WHEN w.amount <= 50000 THEN 25
                   ELSE 50 END)
             + (CASE WHEN w.amount >= 10000 THEN 50 ELSE 0 END)
           ), 0)::numeric AS fees_to_record
      FROM withdrawals w
     WHERE lower(w.status::text) IN ('success', 'completed', 'processed')
       AND COALESCE(w.provider_fee, 0) = 0
       AND NOT EXISTS (SELECT 1 FROM admin_revenue_entries e WHERE e.id = 'wfee_' || w.id)
  ) x
 ORDER BY r.updated_at NULLS LAST, r.id
 LIMIT 1;

-- EXPECTED (from the audit): 54 rows. With the 54 payouts averaging well under
-- N5,000 the total is around N540..N1,350 depending on amounts; every row at or
-- above N10,000 also carries the N50 stamp duty. Check the printed total against
-- SECTION 0.1 before running SECTION 1.


-- ============================================================================
-- SECTION 1 — APPLY. Only run after reading SECTION 0.
-- ============================================================================
BEGIN;

DO $backfill$
DECLARE
  r          record;
  v_fee      numeric;
  v_res      jsonb;
  v_recorded integer := 0;
  v_skipped  integer := 0;
  v_failed   integer := 0;
  v_total    numeric := 0;
  v_after    numeric;
BEGIN
  FOR r IN
    SELECT w.id, w.amount::numeric AS amount
      FROM withdrawals w
     WHERE lower(w.status::text) IN ('success', 'completed', 'processed')
       AND COALESCE(w.provider_fee, 0) = 0
       AND NOT EXISTS (SELECT 1 FROM admin_revenue_entries e WHERE e.id = 'wfee_' || w.id)
     ORDER BY w.processed_at NULLS LAST, w.created_at
       FOR UPDATE OF w SKIP LOCKED
  LOOP
    v_fee := (CASE WHEN r.amount <= 5000  THEN 10
                   WHEN r.amount <= 50000 THEN 25
                   ELSE 50 END)
             + (CASE WHEN r.amount >= 10000 THEN 50 ELSE 0 END);
    BEGIN
      v_res := fb_admin_record_withdrawal_provider_fee(r.id, v_fee, 'computed');
      IF v_res ->> 'status' = 'recorded' THEN
        v_recorded := v_recorded + 1;
        v_total    := v_total + v_fee;
      ELSIF v_res ->> 'status' = 'already_recorded' THEN
        v_skipped := v_skipped + 1;
      ELSE
        v_failed := v_failed + 1;
        RAISE WARNING 'withdrawal % fee not recorded: %', r.id, v_res;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      RAISE WARNING 'withdrawal % fee failed: %', r.id, SQLERRM;
    END;
  END LOOP;

  SELECT COALESCE(available_balance, 0) INTO v_after
    FROM admin_revenue ORDER BY updated_at NULLS LAST, id LIMIT 1;

  RAISE NOTICE 'withdrawal provider fee backfill: recorded %, skipped %, failed %, total % naira, admin_revenue.available_balance now %',
    v_recorded, v_skipped, v_failed, v_total, v_after;
END
$backfill$;

-- Proof inside the same transaction: no successful withdrawal is left unrecorded.
DO $check$
DECLARE
  v_left integer;
BEGIN
  SELECT count(*) INTO v_left
    FROM withdrawals
   WHERE lower(status::text) IN ('success', 'completed', 'processed')
     AND COALESCE(provider_fee, 0) = 0;
  IF v_left <> 0 THEN
    RAISE EXCEPTION 'backfill left % successful withdrawals with no recorded fee; rolling back', v_left;
  END IF;
  RAISE NOTICE 'verification passed: every successful withdrawal has a recorded provider fee';
END
$check$;

COMMIT;

-- Expected output: two NOTICE lines then COMMIT. Re-running reports recorded 0.
