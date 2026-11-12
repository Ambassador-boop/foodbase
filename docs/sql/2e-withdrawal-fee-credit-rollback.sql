-- ============================================================================
-- Batch 2e — Problem 1 rollback
-- ============================================================================
-- Removes only what 2e-withdrawal-fee-credit.sql added. No existing function was
-- replaced, so nothing needs restoring.
--
-- The application keeps working after this: lib/withdrawals.ts wraps the call and
-- logs "fb_record_withdrawal_fee is missing ..." then falls back to
-- fb_credit_withdrawal_fee, exactly the behaviour before this batch. A payout or
-- webhook is never broken by this rollback.
--
-- NOTE: fees already credited stay credited (withdrawals.fee_credited, the
-- 'wfe_<id>' ledger rows and the admin_revenue move). This script reverses no
-- money. Undoing a credited fee is a separate, explicit decision per withdrawal.
-- The columns are left in place on purpose: dropping them would destroy the
-- record of which fees were credited.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.fb_record_withdrawal_fee(text);

COMMIT;

DROP INDEX IF EXISTS public.ux_admin_revenue_entries_withdrawal_fee;

-- Expected result: DROP FUNCTION, DROP INDEX.
