-- ============================================================================
-- Batch 2e — Problem 2 test (self-contained, leaves nothing behind)
-- ============================================================================
-- Everything runs inside one transaction and ends with ROLLBACK. Fixtures are
-- withdrawals rows cloned from one existing row with a `wd_test2e_pf_` id and
-- `wfee_wd_test2e_pf_` ledger entries. Safe to run on production.
--
-- It proves, against the live function:
--   1  a successful withdrawal records its fee once: provider_fee = fee,
--      provider_fee_source, exactly one 'provider_fee' ledger row at -fee,
--      available_balance -fee, expenses_amount +fee (when that column exists),
--      total_revenue unchanged
--   2  a second call is a no-op ('already_recorded'), even with a different fee
--   3  a pending withdrawal records nothing ('not_success')
--   4  a failed withdrawal records nothing ('not_success')
--   5  a reversed withdrawal records nothing ('not_success')
--   6  a zero fee records nothing ('nothing_to_record')
--   7  a negative fee is refused ('invalid_fee')
--   8  an unknown id is refused ('not_found'), an empty id ('invalid_withdrawal')
--   9  a ledger row that exists without the column is healed, not double-recorded
--
-- Expected output at the end: one row, "2e withdrawal provider fee: all checks passed".
-- ============================================================================

BEGIN;

DO $test$
DECLARE
  v_rev      text;
  v_avail0   numeric;
  v_exp0     numeric;
  v_total0   numeric;
  v_avail    numeric;
  v_exp      numeric;
  v_total    numeric;
  v_res      jsonb;
  v_count    integer;
  v_amount   numeric;
  v_has_exp  boolean;
  v_source   record;
BEGIN
  SELECT count(*) INTO v_count FROM admin_revenue;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'this test expects exactly one admin_revenue row, found %', v_count;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'admin_revenue' AND column_name = 'expenses_amount'
  ) INTO v_has_exp;

  SELECT id, COALESCE(available_balance, 0), COALESCE(total_revenue, 0),
         COALESCE((to_jsonb(admin_revenue) ->> 'expenses_amount')::numeric, 0)
    INTO v_rev, v_avail0, v_total0, v_exp0
    FROM admin_revenue
   ORDER BY updated_at NULLS LAST, id
   LIMIT 1;

  SELECT * INTO v_source FROM withdrawals ORDER BY created_at LIMIT 1;
  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'this test needs at least one existing withdrawals row to clone as a fixture';
  END IF;

  INSERT INTO withdrawals
  SELECT (jsonb_populate_record(NULL::public.withdrawals,
            to_jsonb(v_source) || jsonb_build_object(
              'id', 'wd_test2e_pf_ok',
              'status', 'success',
              'withdrawal_fee', 0,
              'fee_credited', true,
              'fee_credited_at', now(),
              'provider_fee', 0,
              'provider_fee_source', NULL,
              'provider_fee_recorded_at', NULL,
              'reference', 'test_2e_pf_ref_ok',
              'payment_reference', NULL,
              'transfer_code', 'test_2e_pf_code_ok',
              'paystack_transfer_id', NULL,
              'transfer_recipient_id', NULL,
              'processed_at', now(),
              'created_at', now(),
              'updated_at', now()
            ))).*
  UNION ALL
  SELECT (jsonb_populate_record(NULL::public.withdrawals,
            to_jsonb(v_source) || jsonb_build_object(
              'id', 'wd_test2e_pf_pending',
              'status', 'pending',
              'withdrawal_fee', 0,
              'fee_credited', false,
              'fee_credited_at', NULL,
              'provider_fee', 0,
              'provider_fee_source', NULL,
              'provider_fee_recorded_at', NULL,
              'reference', 'test_2e_pf_ref_pending',
              'payment_reference', NULL,
              'transfer_code', 'test_2e_pf_code_pending',
              'paystack_transfer_id', NULL,
              'transfer_recipient_id', NULL,
              'created_at', now(),
              'updated_at', now()
            ))).*
  UNION ALL
  SELECT (jsonb_populate_record(NULL::public.withdrawals,
            to_jsonb(v_source) || jsonb_build_object(
              'id', 'wd_test2e_pf_failed',
              'status', 'failed',
              'withdrawal_fee', 0,
              'fee_credited', false,
              'fee_credited_at', NULL,
              'provider_fee', 0,
              'provider_fee_source', NULL,
              'provider_fee_recorded_at', NULL,
              'reference', 'test_2e_pf_ref_failed',
              'payment_reference', NULL,
              'transfer_code', 'test_2e_pf_code_failed',
              'paystack_transfer_id', NULL,
              'transfer_recipient_id', NULL,
              'created_at', now(),
              'updated_at', now()
            ))).*
  UNION ALL
  SELECT (jsonb_populate_record(NULL::public.withdrawals,
            to_jsonb(v_source) || jsonb_build_object(
              'id', 'wd_test2e_pf_reversed',
              'status', 'reversed',
              'withdrawal_fee', 0,
              'fee_credited', false,
              'fee_credited_at', NULL,
              'provider_fee', 0,
              'provider_fee_source', NULL,
              'provider_fee_recorded_at', NULL,
              'reference', 'test_2e_pf_ref_reversed',
              'payment_reference', NULL,
              'transfer_code', 'test_2e_pf_code_reversed',
              'paystack_transfer_id', NULL,
              'transfer_recipient_id', NULL,
              'created_at', now(),
              'updated_at', now()
            ))).*
  UNION ALL
  SELECT (jsonb_populate_record(NULL::public.withdrawals,
            to_jsonb(v_source) || jsonb_build_object(
              'id', 'wd_test2e_pf_zero',
              'status', 'success',
              'withdrawal_fee', 0,
              'fee_credited', true,
              'fee_credited_at', now(),
              'provider_fee', 0,
              'provider_fee_source', NULL,
              'provider_fee_recorded_at', NULL,
              'reference', 'test_2e_pf_ref_zero',
              'payment_reference', NULL,
              'transfer_code', 'test_2e_pf_code_zero',
              'paystack_transfer_id', NULL,
              'transfer_recipient_id', NULL,
              'processed_at', now(),
              'created_at', now(),
              'updated_at', now()
            ))).*
  UNION ALL
  SELECT (jsonb_populate_record(NULL::public.withdrawals,
            to_jsonb(v_source) || jsonb_build_object(
              'id', 'wd_test2e_pf_healed',
              'status', 'success',
              'withdrawal_fee', 0,
              'fee_credited', true,
              'fee_credited_at', now(),
              'provider_fee', 0,
              'provider_fee_source', NULL,
              'provider_fee_recorded_at', NULL,
              'reference', 'test_2e_pf_ref_healed',
              'payment_reference', NULL,
              'transfer_code', 'test_2e_pf_code_healed',
              'paystack_transfer_id', NULL,
              'transfer_recipient_id', NULL,
              'processed_at', now(),
              'created_at', now(),
              'updated_at', now()
            ))).*;

  ------------------------------------------------------------ 1  record once
  v_res := fb_admin_record_withdrawal_provider_fee('wd_test2e_pf_ok', 75, 'computed');
  IF v_res ->> 'status' <> 'recorded' THEN
    RAISE EXCEPTION '1 expected recorded, got %', v_res;
  END IF;
  IF (v_res ->> 'fee')::numeric <> 75 THEN
    RAISE EXCEPTION '1 expected fee 75, got %', v_res ->> 'fee';
  END IF;

  SELECT count(*) INTO v_count FROM admin_revenue_entries
   WHERE id = 'wfee_wd_test2e_pf_ok' AND kind = 'provider_fee' AND withdrawal_id = 'wd_test2e_pf_ok';
  IF v_count <> 1 THEN
    RAISE EXCEPTION '1 expected one ledger row, found %', v_count;
  END IF;
  SELECT amount INTO v_amount FROM admin_revenue_entries WHERE id = 'wfee_wd_test2e_pf_ok';
  IF v_amount <> -75 THEN
    RAISE EXCEPTION '1 expected ledger -75, got %', v_amount;
  END IF;

  IF (SELECT provider_fee FROM withdrawals WHERE id = 'wd_test2e_pf_ok') <> 75 THEN
    RAISE EXCEPTION '1 expected provider_fee 75';
  END IF;
  IF (SELECT provider_fee_source FROM withdrawals WHERE id = 'wd_test2e_pf_ok') <> 'computed' THEN
    RAISE EXCEPTION '1 expected provider_fee_source computed';
  END IF;
  IF (SELECT provider_fee_recorded_at FROM withdrawals WHERE id = 'wd_test2e_pf_ok') IS NULL THEN
    RAISE EXCEPTION '1 expected provider_fee_recorded_at set';
  END IF;

  SELECT COALESCE(available_balance, 0), COALESCE(total_revenue, 0),
         COALESCE((to_jsonb(admin_revenue) ->> 'expenses_amount')::numeric, 0)
    INTO v_avail, v_total, v_exp
    FROM admin_revenue WHERE id = v_rev;
  IF v_avail <> v_avail0 - 75 THEN
    RAISE EXCEPTION '1 expected available_balance % got %', v_avail0 - 75, v_avail;
  END IF;
  IF v_total <> v_total0 THEN
    RAISE EXCEPTION '1 expected total_revenue unchanged at % got %', v_total0, v_total;
  END IF;
  IF v_has_exp AND v_exp <> v_exp0 + 75 THEN
    RAISE EXCEPTION '1 expected expenses_amount % got %', v_exp0 + 75, v_exp;
  END IF;

  -------------------------------------------------------- 2  second call no-op
  v_res := fb_admin_record_withdrawal_provider_fee('wd_test2e_pf_ok', 999, 'provider');
  IF v_res ->> 'status' <> 'already_recorded' THEN
    RAISE EXCEPTION '2 expected already_recorded, got %', v_res;
  END IF;
  SELECT count(*) INTO v_count FROM admin_revenue_entries WHERE withdrawal_id = 'wd_test2e_pf_ok';
  IF v_count <> 1 THEN
    RAISE EXCEPTION '2 expected still one ledger row, found %', v_count;
  END IF;
  SELECT COALESCE(available_balance, 0) INTO v_avail FROM admin_revenue WHERE id = v_rev;
  IF v_avail <> v_avail0 - 75 THEN
    RAISE EXCEPTION '2 expected no second fee, available is %', v_avail;
  END IF;

  -------------------------------------------------- 3-5  never on a failure
  v_res := fb_admin_record_withdrawal_provider_fee('wd_test2e_pf_pending', 75, 'computed');
  IF v_res ->> 'status' <> 'not_success' THEN
    RAISE EXCEPTION '3 expected not_success, got %', v_res;
  END IF;
  v_res := fb_admin_record_withdrawal_provider_fee('wd_test2e_pf_failed', 75, 'computed');
  IF v_res ->> 'status' <> 'not_success' THEN
    RAISE EXCEPTION '4 expected not_success, got %', v_res;
  END IF;
  v_res := fb_admin_record_withdrawal_provider_fee('wd_test2e_pf_reversed', 75, 'computed');
  IF v_res ->> 'status' <> 'not_success' THEN
    RAISE EXCEPTION '5 expected not_success, got %', v_res;
  END IF;
  SELECT count(*) INTO v_count FROM admin_revenue_entries
   WHERE withdrawal_id IN ('wd_test2e_pf_pending', 'wd_test2e_pf_failed', 'wd_test2e_pf_reversed');
  IF v_count <> 0 THEN
    RAISE EXCEPTION '3-5 no ledger row may exist for a failed payout, found %', v_count;
  END IF;
  SELECT COALESCE(available_balance, 0) INTO v_avail FROM admin_revenue WHERE id = v_rev;
  IF v_avail <> v_avail0 - 75 THEN
    RAISE EXCEPTION '3-5 available_balance moved on a failed payout: %', v_avail;
  END IF;

  ---------------------------------------------------- 6-8  bad fees and ids
  v_res := fb_admin_record_withdrawal_provider_fee('wd_test2e_pf_ok', 0, 'computed');
  IF v_res ->> 'status' <> 'already_recorded' THEN
    RAISE EXCEPTION '6 expected already_recorded on an already-paid fee, got %', v_res;
  END IF;
  v_res := fb_admin_record_withdrawal_provider_fee('wd_test2e_pf_zero', 0, 'computed');
  IF v_res ->> 'status' <> 'nothing_to_record' THEN
    RAISE EXCEPTION '6 expected nothing_to_record, got %', v_res;
  END IF;
  v_res := fb_admin_record_withdrawal_provider_fee('wd_test2e_pf_pending', 0, 'computed');
  IF v_res ->> 'status' <> 'not_success' THEN
    RAISE EXCEPTION '6 expected not_success, got %', v_res;
  END IF;
  v_res := fb_admin_record_withdrawal_provider_fee('wd_test2e_pf_healed', -5, 'computed');
  IF v_res ->> 'status' <> 'invalid_fee' THEN
    RAISE EXCEPTION '7 expected invalid_fee, got %', v_res;
  END IF;
  v_res := fb_admin_record_withdrawal_provider_fee('wd_test2e_pf_missing', 75, 'computed');
  IF v_res ->> 'status' <> 'not_found' THEN
    RAISE EXCEPTION '8 expected not_found, got %', v_res;
  END IF;
  v_res := fb_admin_record_withdrawal_provider_fee('', 75, 'computed');
  IF v_res ->> 'status' <> 'invalid_withdrawal' THEN
    RAISE EXCEPTION '8 expected invalid_withdrawal, got %', v_res;
  END IF;

  ------------------------------------------------- 9  ledger row without column
  INSERT INTO admin_revenue_entries (id, kind, withdrawal_id, amount)
  VALUES ('wfee_wd_test2e_pf_healed', 'provider_fee', 'wd_test2e_pf_healed', -25);
  v_res := fb_admin_record_withdrawal_provider_fee('wd_test2e_pf_healed', 25, 'computed');
  IF v_res ->> 'status' <> 'already_recorded' THEN
    RAISE EXCEPTION '9 expected already_recorded, got %', v_res;
  END IF;
  IF COALESCE((v_res ->> 'healed_flag')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION '9 expected healed_flag true, got %', v_res;
  END IF;
  IF (SELECT provider_fee FROM withdrawals WHERE id = 'wd_test2e_pf_healed') <> 25 THEN
    RAISE EXCEPTION '9 expected provider_fee healed to 25';
  END IF;
  SELECT count(*) INTO v_count FROM admin_revenue_entries WHERE withdrawal_id = 'wd_test2e_pf_healed';
  IF v_count <> 1 THEN
    RAISE EXCEPTION '9 expected one ledger row, found %', v_count;
  END IF;

  -------------------------------------------------------------- final totals
  SELECT COALESCE(available_balance, 0) INTO v_avail FROM admin_revenue WHERE id = v_rev;
  IF v_avail <> v_avail0 - 75 THEN
    RAISE EXCEPTION 'final available_balance drifted: expected % got %', v_avail0 - 75, v_avail;
  END IF;
END
$test$;

SELECT '2e withdrawal provider fee: all checks passed' AS result;

ROLLBACK;
