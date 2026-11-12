-- ============================================================================
-- Batch 2e — Problem 2 rollback
-- ============================================================================
-- Removes only what 2e-withdrawal-provider-fee.sql added. No existing function
-- was replaced.
--
-- The application keeps working after this: lib/withdrawals.ts wraps the call and
-- logs "fb_admin_record_withdrawal_provider_fee is missing ..." instead of
-- failing a payout or a webhook, and lib/admin-analytics.ts reports the payout
-- fee component as 0. Admin revenue simply stops including payout fees again,
-- which is the behaviour before this batch.
--
-- NOTE: fees already recorded stay recorded (withdrawals.provider_fee, their
-- 'wfee_<id>' ledger rows and the admin_revenue move). This rollback reverses no
-- money and leaves the columns in place so the record of what was recorded
-- survives. Dropping a column would erase it.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.fb_admin_record_withdrawal_provider_fee(text, numeric, text);
DROP FUNCTION IF EXISTS public.fb_admin_record_withdrawal_provider_fee(text, numeric);

COMMIT;

-- The index is shared with batch 2d on purpose; only drop it if 2d is also being
-- rolled back. Left in place here.
-- DROP INDEX IF EXISTS public.ux_admin_revenue_entries_provider_fee;

-- Expected result: DROP FUNCTION, DROP FUNCTION.
