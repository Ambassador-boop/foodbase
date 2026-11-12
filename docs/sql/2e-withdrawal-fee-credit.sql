-- ============================================================================
-- Batch 2e — Problem 1: credit the business withdrawal fee to admin revenue
-- ============================================================================
-- Read this before running.
--
-- WHY
--   `withdrawals.withdrawal_fee` is charged to the business when it reserves a
--   payout (fb_reserve_withdrawal), and the fee is real money the platform keeps.
--   All 54 successful withdrawals still have fee_credited = false and there are
--   zero 'withdrawal_fee' rows in admin_revenue_entries, so analytics counts
--   ~N2,000 of fee revenue that never reached admin_revenue.
--
--   The call sites in TypeScript exist but they call `fb_credit_withdrawal_fee`,
--   whose body is NOT in this repository, so its behaviour cannot be audited or
--   trusted. This script does not touch it. It adds a function this repository
--   owns end to end, and TypeScript prefers it, falling back to the old one.
--
-- WHAT THIS ADDS (nothing is removed, no existing function is replaced)
--   1. withdrawals.fee_credited_at  (timestamptz, nullable) — when the fee was
--      booked, next to the existing withdrawals.fee_credited boolean.
--   2. fb_record_withdrawal_fee(withdrawal_id) -> jsonb
--        * only acts on a withdrawal whose status, lowercased, is
--          'success' | 'completed' | 'processed'
--        * only once per withdrawal. Idempotency has two independent guards:
--            - withdrawals.fee_credited (set in the same transaction)
--            - the ledger primary key 'wfe_<withdrawal_id>', checked inside the
--              same SELECT ... FOR UPDATE lock on the withdrawal row, so two
--              concurrent callers serialise and the loser sees the winner's work
--        * inserts exactly one admin_revenue_entries row:
--              id      = 'wfe_<withdrawal_id>'
--              kind    = 'withdrawal_fee'
--              amount  = +withdrawal_fee
--        * moves admin_revenue.total_revenue    up by the fee
--        * moves admin_revenue.available_balance up by the fee
--        * never touches expenses_amount: the fee is revenue the platform keeps,
--          not a cost.
--   3. A partial unique index so one 'withdrawal_fee' entry per withdrawal
--      exists whatever code writes it in future.
--
-- UNITS: naira, like every other money column on these tables.
--
-- SAFETY: additive only. No row is updated by this script itself. Re-runnable.
-- ============================================================================

BEGIN;

-- The boolean already exists in production; IF NOT EXISTS keeps this a no-op there.
ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS fee_credited boolean NOT NULL DEFAULT false;

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS fee_credited_at timestamptz;

CREATE OR REPLACE FUNCTION public.fb_record_withdrawal_fee(
  p_id text
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  w        withdrawals%ROWTYPE;
  v_fee    numeric;
  v_rev    text;
  v_entry  text;
  v_marker integer;
BEGIN
  IF p_id IS NULL OR p_id = '' THEN
    RETURN jsonb_build_object('status', 'invalid_withdrawal');
  END IF;

  -- One caller at a time for this withdrawal, for the whole check-and-write.
  SELECT * INTO w FROM withdrawals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  -- A fee is only ever kept on a payout that actually completed.
  IF lower(w.status::text) NOT IN ('success', 'completed', 'processed') THEN
    RETURN jsonb_build_object('status', 'not_success', 'withdrawal_status', w.status);
  END IF;

  v_fee := COALESCE(w.withdrawal_fee, 0);
  IF v_fee <= 0 THEN
    RETURN jsonb_build_object('status', 'nothing_to_credit', 'fee', 0);
  END IF;

  v_entry := 'wfe_' || w.id;

  -- Already credited: by the flag, or by the ledger marker if a previous call
  -- wrote the ledger row and was interrupted before setting the flag.
  IF COALESCE(w.fee_credited, false) THEN
    RETURN jsonb_build_object('status', 'already_credited', 'fee', v_fee);
  END IF;
  SELECT count(*) INTO v_marker FROM admin_revenue_entries e WHERE e.id = v_entry;
  IF v_marker > 0 THEN
    UPDATE withdrawals
       SET fee_credited    = true,
           fee_credited_at = COALESCE(fee_credited_at, now())
     WHERE id = w.id;
    RETURN jsonb_build_object('status', 'already_credited', 'fee', v_fee, 'healed_flag', true);
  END IF;

  SELECT id INTO v_rev
    FROM admin_revenue
   ORDER BY updated_at NULLS LAST, id
   LIMIT 1
   FOR UPDATE;
  IF v_rev IS NULL THEN
    RETURN jsonb_build_object('status', 'no_revenue_row');
  END IF;

  -- Ledger first: its primary key is the idempotency marker.
  INSERT INTO admin_revenue_entries (id, kind, withdrawal_id, amount)
  VALUES (v_entry, 'withdrawal_fee', w.id, v_fee);

  UPDATE withdrawals
     SET fee_credited    = true,
         fee_credited_at = COALESCE(fee_credited_at, now()),
         updated_at      = now()
   WHERE id = w.id;

  UPDATE admin_revenue
     SET total_revenue     = COALESCE(total_revenue, 0)     + v_fee,
         available_balance = COALESCE(available_balance, 0) + v_fee,
         updated_at        = now()
   WHERE id = v_rev;

  RETURN jsonb_build_object(
    'status', 'credited',
    'withdrawal_id', w.id,
    'business_id', w.business_id,
    'fee', v_fee
  );
END
$function$;

COMMIT;

-- Belt and braces: one withdrawal_fee entry per withdrawal, whoever writes it.
-- Existing rows are unaffected. Safe to run more than once.
CREATE UNIQUE INDEX IF NOT EXISTS ux_admin_revenue_entries_withdrawal_fee
  ON public.admin_revenue_entries (withdrawal_id)
  WHERE kind = 'withdrawal_fee' AND withdrawal_id IS NOT NULL;

-- Expected result: ALTER TABLE, ALTER TABLE, CREATE FUNCTION, COMMIT, CREATE INDEX.
-- Nothing is credited by running this file. Verify with 2e-withdrawal-fee-credit-test.sql,
-- then preview the backfill with 2e-backfill-withdrawal-fee-credit.sql.
