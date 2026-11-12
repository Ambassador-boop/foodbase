-- ============================================================================
-- Batch 2e — Problem 2: record the Paystack payout fee on a business withdrawal
-- ============================================================================
-- Read this before running. Additive and re-runnable; it replaces no function and
-- changes no existing row.
--
-- WHY
--   Paystack deducts its transfer fee (and, at N10,000 and above, the N50 stamp
--   duty) from the platform balance on every successful payout. Nothing recorded
--   that for business withdrawals, so admin revenue and expenses were both wrong
--   by the fee on each of the 54 successful payouts. This is the 2d pattern
--   (fb_admin_record_transfer_fee) applied to withdrawals.
--
-- WHAT THIS ADDS
--   1. withdrawals.provider_fee             numeric NOT NULL DEFAULT 0
--      withdrawals.provider_fee_source      text      ('computed' | 'provider')
--      withdrawals.provider_fee_recorded_at timestamptz
--   2. fb_admin_record_withdrawal_provider_fee(withdrawal_id, fee, source) -> jsonb
--        * only acts on a withdrawal whose status, lowercased, is
--          'success' | 'completed' | 'processed'. A failed, reversed, abandoned,
--          blocked, rejected or still-pending payout records nothing.
--        * only once per withdrawal. Two independent guards, both read inside the
--          SELECT ... FOR UPDATE lock on the withdrawal row:
--            - withdrawals.provider_fee <> 0
--            - the ledger primary key 'wfee_<withdrawal_id>'
--        * inserts exactly one admin_revenue_entries row:
--              id      = 'wfee_<withdrawal_id>'
--              kind    = 'provider_fee'
--              amount  = -fee
--        * moves admin_revenue.available_balance down by the fee and
--          expenses_amount up by the same fee. total_revenue is left alone, the
--          same way the 2d transfer fee is treated: a cost is not revenue.
--        * tolerates a database where expenses_amount does not exist yet (the
--          column is only maintained when it is there).
--   3. A partial unique index: one 'provider_fee' entry per withdrawal. The 2d
--      batch already created the same index (same name, same definition); this
--      is a no-op where it exists.
--
-- UNITS: naira, like every money column on these tables. lib/paystack-fees.ts
-- converts the provider's kobo figure before calling this.
--
-- HIDDEN FROM BUSINESS OWNERS (docx #9). No business-facing API or page is
-- changed by this batch, and none of them selects this column:
--   * GET /api/business/withdrawals            — explicit column whitelist
--   * GET /api/withdrawals/[withdrawalId]      — explicit response object
--   * GET /api/business/withdrawals/policy     — totals only
-- ============================================================================

BEGIN;

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS provider_fee numeric NOT NULL DEFAULT 0;

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS provider_fee_source text;

ALTER TABLE public.withdrawals
  ADD COLUMN IF NOT EXISTS provider_fee_recorded_at timestamptz;

CREATE OR REPLACE FUNCTION public.fb_admin_record_withdrawal_provider_fee(
  p_id     text,
  p_fee    numeric,
  p_source text DEFAULT 'computed'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  w          withdrawals%ROWTYPE;
  v_rev      text;
  v_entry    text;
  v_marker   integer;
  v_has_exp  boolean;
BEGIN
  IF p_id IS NULL OR p_id = '' THEN
    RETURN jsonb_build_object('status', 'invalid_withdrawal');
  END IF;

  -- Serialise every caller for this withdrawal.
  SELECT * INTO w FROM withdrawals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF lower(w.status::text) NOT IN ('success', 'completed', 'processed') THEN
    RETURN jsonb_build_object('status', 'not_success', 'withdrawal_status', w.status);
  END IF;

  IF p_fee IS NULL OR p_fee < 0 THEN
    RETURN jsonb_build_object('status', 'invalid_fee');
  END IF;

  v_entry := 'wfee_' || w.id;

  IF COALESCE(w.provider_fee, 0) <> 0 THEN
    RETURN jsonb_build_object('status', 'already_recorded', 'fee', w.provider_fee);
  END IF;

  -- Checked after 'already_recorded' on purpose: a no-op call on a payout that
  -- already has its fee should read as a no-op, not as a problem to investigate.
  IF p_fee = 0 THEN
    RETURN jsonb_build_object('status', 'nothing_to_record');
  END IF;
  SELECT count(*) INTO v_marker FROM admin_revenue_entries e WHERE e.id = v_entry;
  IF v_marker > 0 THEN
    UPDATE withdrawals
       SET provider_fee             = p_fee,
           provider_fee_source      = COALESCE(NULLIF(p_source, ''), 'computed'),
           provider_fee_recorded_at = COALESCE(provider_fee_recorded_at, now())
     WHERE id = w.id;
    RETURN jsonb_build_object('status', 'already_recorded', 'fee', p_fee, 'healed_flag', true);
  END IF;

  SELECT id INTO v_rev
    FROM admin_revenue
   ORDER BY updated_at NULLS LAST, id
   LIMIT 1
   FOR UPDATE;
  IF v_rev IS NULL THEN
    RETURN jsonb_build_object('status', 'no_revenue_row');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'admin_revenue'
       AND column_name = 'expenses_amount'
  ) INTO v_has_exp;

  -- Ledger first: its primary key is the idempotency marker.
  INSERT INTO admin_revenue_entries (id, kind, withdrawal_id, amount)
  VALUES (v_entry, 'provider_fee', w.id, -p_fee);

  UPDATE withdrawals
     SET provider_fee             = p_fee,
         provider_fee_source      = COALESCE(NULLIF(p_source, ''), 'computed'),
         provider_fee_recorded_at = now(),
         updated_at               = now()
   WHERE id = w.id;

  IF v_has_exp THEN
    UPDATE admin_revenue
       SET available_balance = COALESCE(available_balance, 0) - p_fee,
           expenses_amount   = COALESCE(expenses_amount, 0)   + p_fee,
           updated_at        = now()
     WHERE id = v_rev;
  ELSE
    UPDATE admin_revenue
       SET available_balance = COALESCE(available_balance, 0) - p_fee,
           updated_at        = now()
     WHERE id = v_rev;
  END IF;

  RETURN jsonb_build_object(
    'status', 'recorded',
    'withdrawal_id', w.id,
    'business_id', w.business_id,
    'fee', p_fee,
    'source', COALESCE(NULLIF(p_source, ''), 'computed')
  );
END
$function$;

COMMIT;

CREATE UNIQUE INDEX IF NOT EXISTS ux_admin_revenue_entries_provider_fee
  ON public.admin_revenue_entries (withdrawal_id)
  WHERE kind = 'provider_fee' AND withdrawal_id IS NOT NULL;

-- Expected result: ALTER TABLE x3, CREATE FUNCTION, COMMIT, CREATE INDEX
-- (or a no-op notice when 2d already created the index).
-- Nothing is recorded by running this file. Verify with
-- 2e-withdrawal-provider-fee-test.sql, then preview the backfill with
-- 2e-backfill-withdrawal-provider-fee.sql.
