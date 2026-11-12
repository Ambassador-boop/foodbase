-- ============================================================================
-- Batch 2d — rollback
-- ============================================================================
-- Removes only what docs/sql/2d-transfer-fee.sql added. No existing function was
-- changed by that script, so nothing needs restoring.
--
-- The application keeps working after this: lib/admin-transfers.ts wraps the call
-- and logs "fb_admin_record_transfer_fee is missing: run docs/sql/2d-transfer-fee.sql"
-- instead of failing the sync, and lib/admin-analytics.ts falls back to a summary
-- without fees. Admin revenue simply stops including the fee again, which is the
-- behaviour before this batch.
--
-- NOTE: fees already recorded stay recorded (admin_transfers.provider_fee, their
-- admin_revenue_entries rows, and the admin_revenue move). This rollback does not
-- reverse money. If you ever want the recorded fees undone, that is a separate,
-- explicit decision per transfer.
-- ============================================================================

BEGIN;

DROP FUNCTION IF EXISTS public.fb_admin_record_transfer_fee(text, numeric, text);
DROP FUNCTION IF EXISTS public.fb_admin_record_transfer_fee(text, numeric);

COMMIT;

DROP INDEX IF EXISTS public.ux_admin_revenue_entries_provider_fee;

-- Expected result: DROP FUNCTION, DROP FUNCTION, DROP INDEX.
