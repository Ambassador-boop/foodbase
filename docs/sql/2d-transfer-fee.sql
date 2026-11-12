-- ============================================================================
-- Batch 2d — record Paystack transfer fees on admin SMS funding
-- ============================================================================
-- Read this before running. Additive, safe to re-run, and it changes no existing
-- function: fb_admin_reserve_transfer, fb_admin_reverse_transfer,
-- fb_request_refund, fb_reverse_failed_refund and fb_settle_due_transactions are
-- untouched.
--
-- WHY
--   fb_admin_reserve_transfer debits admin_revenue.available_balance by the amount
--   and adds the same amount to expenses_amount. Paystack also takes its transfer
--   fee (and, from ₦10,000 up, the ₦50 stamp duty) out of the same balance, and
--   nothing recorded that, so admin revenue was overstated by the fee on every
--   successful funding.
--
-- WHAT THIS ADDS
--   fb_admin_record_transfer_fee(transfer_id, fee, source)
--     * only acts on an admin_transfers row whose status is 'success'
--     * only once per transfer. The idempotency marker is the ledger entry id
--       'are_fee_<transfer_id>' (primary key) plus provider_fee <> 0, checked
--       after SELECT ... FOR UPDATE on the transfer row, so two concurrent
--       callers serialise and the second sees the first one's work
--     * sets admin_transfers.provider_fee
--     * inserts exactly one admin_revenue_entries row: kind 'provider_fee',
--       negative amount, withdrawal_id = the transfer id
--     * moves admin_revenue.available_balance down by the fee and expenses_amount
--       up by the same fee. total_revenue is left alone, exactly like the amount
--       reserved for the transfer itself.
--   A failed or reversed transfer records no fee, and fb_admin_reverse_transfer
--   still reverses only the transfer amount, never the fee.
--
-- UNITS: the fee is naira, like every other money column on these tables. The
-- Paystack API reports kobo; lib/paystack-fees.ts divides before calling this.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fb_admin_record_transfer_fee(
  p_id     text,
  p_fee    numeric,
  p_source text DEFAULT 'computed'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $function$
DECLARE
  t        admin_transfers%ROWTYPE;
  v_rev    text;
  v_entry  text;
  v_marker integer;
BEGIN
  IF p_id IS NULL OR p_id = '' THEN
    RETURN jsonb_build_object('status', 'invalid_transfer');
  END IF;

  -- Serialise every caller for this transfer.
  SELECT * INTO t FROM admin_transfers WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'not_found');
  END IF;

  IF lower(t.status) <> 'success' THEN
    RETURN jsonb_build_object('status', 'not_success', 'transfer_status', t.status);
  END IF;

  IF p_fee IS NULL OR p_fee < 0 THEN
    RETURN jsonb_build_object('status', 'invalid_fee');
  END IF;

  IF p_fee = 0 THEN
    RETURN jsonb_build_object('status', 'nothing_to_record');
  END IF;

  v_entry := 'are_fee_' || t.id;

  -- Already recorded: by the column, or by the ledger marker if a previous call
  -- was interrupted between the two writes.
  IF COALESCE(t.provider_fee, 0) <> 0 THEN
    RETURN jsonb_build_object('status', 'already_recorded', 'fee', t.provider_fee);
  END IF;
  SELECT count(*) INTO v_marker FROM admin_revenue_entries e WHERE e.id = v_entry;
  IF v_marker > 0 THEN
    RETURN jsonb_build_object('status', 'already_recorded', 'fee', COALESCE(t.provider_fee, 0));
  END IF;

  SELECT id INTO v_rev FROM admin_revenue ORDER BY updated_at NULLS LAST, id LIMIT 1 FOR UPDATE;
  IF v_rev IS NULL THEN
    RETURN jsonb_build_object('status', 'no_revenue_row');
  END IF;

  -- Ledger first: the primary key is the idempotency marker.
  INSERT INTO admin_revenue_entries (id, kind, withdrawal_id, amount)
  VALUES (v_entry, 'provider_fee', t.id, -p_fee);

  UPDATE admin_transfers
     SET provider_fee = p_fee,
         updated_at   = now()
   WHERE id = t.id;

  UPDATE admin_revenue
     SET available_balance = COALESCE(available_balance, 0) - p_fee,
         expenses_amount   = COALESCE(expenses_amount, 0)   + p_fee,
         updated_at        = now()
   WHERE id = v_rev;

  RETURN jsonb_build_object(
    'status', 'recorded',
    'transfer_id', t.id,
    'kind', t.kind,
    'fee', p_fee,
    'source', COALESCE(NULLIF(p_source, ''), 'computed')
  );
END
$function$;

COMMIT;

-- Optional belt-and-braces: one provider_fee entry per transfer, whatever code
-- writes it in future. Existing provider_fee entries are per payment (order_id,
-- withdrawal_id NULL) and are not affected. Safe to run more than once.
CREATE UNIQUE INDEX IF NOT EXISTS ux_admin_revenue_entries_provider_fee
  ON public.admin_revenue_entries (withdrawal_id)
  WHERE kind = 'provider_fee' AND withdrawal_id IS NOT NULL;

-- Expected result: CREATE FUNCTION, then CREATE INDEX.
-- Verify with docs/sql/2d-transfer-fee-test.sql.
