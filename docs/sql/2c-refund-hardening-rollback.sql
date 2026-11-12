-- ============================================================================
-- Batch 2c — rollback
-- ============================================================================
-- Drops only what docs/sql/2c-refund-hardening.sql created. No function body was
-- changed by that script, so there is no function to restore: the refund functions
-- are exactly as they were before. Dropping the unique guard returns the database
-- to its previous state; the application is already safe without it because
-- fb_reverse_failed_refund is idempotent on its own.
-- ============================================================================

DROP INDEX IF EXISTS public.ux_finance_records_refund_reversed;
DROP INDEX IF EXISTS public.idx_refunds_transaction_live;
DROP INDEX IF EXISTS public.idx_transactions_pending_bucket;

-- Expected result: DROP INDEX, DROP INDEX, DROP INDEX.
-- Nothing was removed from the application by running this, and no data is touched.
