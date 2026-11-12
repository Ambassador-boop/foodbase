-- ============================================================================
-- Batch 2c — refund reversal hardening
-- ============================================================================
-- Read this before running. It is additive, it changes no money arithmetic, and
-- it is safe to re-run.
--
-- WHAT THE INVESTIGATION FOUND
--   * fb_reverse_failed_refund is already the correct reversal: it locks the
--     refund row, refuses anything that is not failed/rejected, refuses a refund
--     whose balance_reversed flag is already set, and credits whichever bucket the
--     transaction sits in NOW.
--   * fb_request_refund already enforces "the bucket must cover the refund"
--     (returns status 'insufficient_balance' with bucket and balance, which
--     lib/refunds.ts maps to a friendly HTTP 409), and already refuses a refund
--     that would exceed the payment (status 'exceeds_refundable').
--     => No function body needs to change. Nothing in this file rewrites
--        fb_request_refund, fb_reverse_failed_refund, fb_settle_due_transactions,
--        fb_admin_reserve_transfer or fb_admin_reverse_transfer.
--   * The duplicate reversal lived in TypeScript (ensureFailedRefundReversed) and
--     has been removed in this batch. fb_reverse_failed_refund is now the only
--     path, so there is no second writer left to disarm.
--
-- WHAT THIS FILE ACTUALLY DOES
--   1. Adds a database-level guard so a second reversal record can never exist for
--      the same refund, whatever code path writes it in future. This is the
--      backstop for rule 1, not a replacement for the application fix.
--   2. Adds two indexes that keep the new read-only invariant checks on the admin
--      Alerts page cheap (refunds by transaction, transactions by settlement state).
--
-- It does NOT add a CHECK constraint to businesses: negative balances are allowed
-- by design (they represent a deficit) and must not be blocked.
-- ============================================================================

BEGIN;

-- 1. One refund_reversed ledger row per refund, enforced by the database.
--    Verified read-only against production before writing this: there are no
--    duplicate refund_reversed rows today, so the index builds cleanly.
CREATE UNIQUE INDEX IF NOT EXISTS ux_finance_records_refund_reversed
  ON public.finance_records (related_id)
  WHERE record_type = 'refund_reversed';

COMMIT;

-- 2. Supporting indexes for the balance invariant checks. Kept outside the block
--    above so a slow build never holds the first two statements open. These are
--    performance only; the Alerts page is correct without them.
CREATE INDEX IF NOT EXISTS idx_refunds_transaction_live
  ON public.refunds (transaction_id)
  WHERE lower(status::text) NOT IN ('failed', 'rejected');

CREATE INDEX IF NOT EXISTS idx_transactions_pending_bucket
  ON public.transactions (business_id)
  WHERE settlement_status::text = 'pending' AND balance_bucket = 'pending';

-- ============================================================================
-- Expected result of running this file: CREATE INDEX, CREATE INDEX, CREATE INDEX.
-- Verify with docs/sql/2c-refund-hardening-test.sql.
-- ============================================================================
