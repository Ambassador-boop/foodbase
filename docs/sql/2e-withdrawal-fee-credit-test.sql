-- ============================================================================
-- Batch 2e — Problem 1 test (self-contained, leaves nothing behind)
-- ============================================================================
-- Everything runs inside one transaction and ends with ROLLBACK. Fixtures are
-- withdrawals rows cloned from one existing row with a `wd_test2e_` id, plus
-- `wfe_wd_test2e_` ledger entries. No real withdrawal, balance or revenue row is
-- left changed. Safe to run on production.
--
-- It proves, against the live function:
--   1  a successful withdrawal credits its fee once: fee_credited true, exactly
--      one 'withdrawal_fee' ledger row at +fee, total_revenue +fee,
--      available_balance +fee, expenses_amount unchanged
--   2  a second call is a no-op ('already_credited'), even with a changed fee
--   3  a pending withdrawal credits nothing ('not_success')
--   4  a zero fee credits nothing ('nothing_to_credit')
--   5  an unknown id is refused ('not_found'), an empty id ('invalid_withdrawal')
--   6  a ledger row that exists without the flag is healed, not double-credited
--
-- Expected output at the end: one row, "2e withdrawal fee credit: all checks passed".
-- ============================================================================

BEGIN;

DO $test$
DECLARE
  v_rev       text;
  v_total0    numeric;
  v_avail0    numeric;
  v_exp0      numeric;
  v_total     numeric;
  v_avail     numeric;
  v_exp       numeric;
  v_res       jsonb;
  v_count     integer;
  v_amount    numeric;
  v_source    record;
BEGIN
  SELECT count(*) INTO v_count FROM admin_revenue;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'this test expects exactly one admin_revenue row, found %', v_count;
  END IF;

  SELECT id, COALESCE(total_revenue, 0), COALESCE(available_balance, 0),
         COALESCE((to_jsonb(admin_revenue) ->> 'expenses_amount')::numeric, 0)
    INTO v_rev, v_total0, v_avail0, v_exp0
    FROM admin_revenue
   ORDER BY updated_at NULLS LAST, id
   LIMIT 1;

  -- A row to clone keeps every NOT NULL column and the business foreign key valid.
  SELECT * INTO v_source FROM withdrawals ORDER BY created_at LIMIT 1;
  IF v_source.id IS NULL THEN
    RAISE EXCEPTION 'this test needs at least one existing withdrawals row to clone as a fixture';
  END IF;

  INSERT INTO withdrawals
  SELECT (jsonb_populate_record(NULL::public.withdrawals,
            to_jsonb(v_source) || jsonb_build_object(
              'id', 'wd_test2e_ok',
              'status', 'success',
              'withdrawal_fee', 500,
              'fee_credited', false,
              'fee_credited_at', NULL,
              'reference', 'test_2e_ref_ok',
              'payment_reference', NULL,
              'transfer_code', 'test_2e_code_ok',
              'paystack_transfer_id', NULL,
              'transfer_recipient_id', NULL,
              'processed_at', now(),
              'created_at', now(),
              'updated_at', now()
            ))).*
  UNION ALL
  SELECT (jsonb_populate_record(NULL::public.withdrawals,
            to_jsonb(v_source) || jsonb_build_object(
              'id', 'wd_test2e_zero',
              'status', 'success',
              'withdrawal_fee', 0,
              'fee_credited', false,
              'fee_credited_at', NULL,
              'reference', 'test_2e_ref_zero',
              'payment_reference', NULL,
              'transfer_code', 'test_2e_code_zero',
              'paystack_transfer_id', NULL,
              'transfer_recipient_id', NULL,
              'processed_at', now(),
              'created_at', now(),
              'updated_at', now()
            ))).*
  UNION ALL
  SELECT (jsonb_populate_record(NULL::public.withdrawals,
            to_jsonb(v_source) || jsonb_build_object(
              'id', 'wd_test2e_pending',
              'status', 'pending',
              'withdrawal_fee', 500,
              'fee_credited', false,
              'fee_credited_at', NULL,
              'reference', 'test_2e_ref_pending',
              'payment_reference', NULL,
              'transfer_code', 'test_2e_code_pending',
              'paystack_transfer_id', NULL,
              'transfer_recipient_id', NULL,
              'created_at', now(),
              'updated_at', now()
            ))).*
  UNION ALL
  SELECT (jsonb_populate_record(NULL::public.withdrawals,
            to_jsonb(v_source) || jsonb_build_object(
              'id', 'wd_test2e_healed',
              'status', 'success',
              'withdrawal_fee', 300,
              'fee_credited', false,
              'fee_credited_at', NULL,
              'reference', 'test_2e_ref_healed',
              'payment_reference', NULL,
              'transfer_code', 'test_2e_code_healed',
              'paystack_transfer_id', NULL,
              'transfer_recipient_id', NULL,
              'processed_at', now(),
              'created_at', now(),
              'updated_at', now()
            ))).*;

  ------------------------------------------------------------ 1  credit once
  v_res := fb_record_withdrawal_fee('wd_test2e_ok');
  IF v_res ->> 'status' <> 'credited' THEN
    RAISE EXCEPTION '1 expected credited, got %', v_res;
  END IF;
  IF (v_res ->> 'fee')::numeric <> 500 THEN
    RAISE EXCEPTION '1 expected fee 500, got %', v_res ->> 'fee';
  END IF;

  SELECT count(*) INTO v_count FROM admin_revenue_entries
   WHERE id = 'wfe_wd_test2e_ok' AND kind = 'withdrawal_fee' AND withdrawal_id = 'wd_test2e_ok';
  IF v_count <> 1 THEN
    RAISE EXCEPTION '1 expected one ledger row, found %', v_count;
  END IF;
  SELECT amount INTO v_amount FROM admin_revenue_entries WHERE id = 'wfe_wd_test2e_ok';
  IF v_amount <> 500 THEN
    RAISE EXCEPTION '1 expected ledger +500, got %', v_amount;
  END IF;

  IF NOT (SELECT fee_credited FROM withdrawals WHERE id = 'wd_test2e_ok') THEN
    RAISE EXCEPTION '1 expected fee_credited true';
  END IF;
  IF (SELECT fee_credited_at FROM withdrawals WHERE id = 'wd_test2e_ok') IS NULL THEN
    RAISE EXCEPTION '1 expected fee_credited_at set';
  END IF;

  SELECT COALESCE(total_revenue, 0), COALESCE(available_balance, 0),
         COALESCE((to_jsonb(admin_revenue) ->> 'expenses_amount')::numeric, 0)
    INTO v_total, v_avail, v_exp
    FROM admin_revenue WHERE id = v_rev;
  IF v_total <> v_total0 + 500 THEN
    RAISE EXCEPTION '1 expected total_revenue % got %', v_total0 + 500, v_total;
  END IF;
  IF v_avail <> v_avail0 + 500 THEN
    RAISE EXCEPTION '1 expected available_balance % got %', v_avail0 + 500, v_avail;
  END IF;
  IF v_exp <> v_exp0 THEN
    RAISE EXCEPTION '1 expected expenses_amount unchanged at % got %', v_exp0, v_exp;
  END IF;

  -------------------------------------------------------- 2  second call no-op
  UPDATE withdrawals SET withdrawal_fee = 900 WHERE id = 'wd_test2e_ok';
  v_res := fb_record_withdrawal_fee('wd_test2e_ok');
  IF v_res ->> 'status' <> 'already_credited' THEN
    RAISE EXCEPTION '2 expected already_credited, got %', v_res;
  END IF;
  SELECT count(*) INTO v_count FROM admin_revenue_entries WHERE withdrawal_id = 'wd_test2e_ok';
  IF v_count <> 1 THEN
    RAISE EXCEPTION '2 expected still one ledger row, found %', v_count;
  END IF;
  SELECT COALESCE(available_balance, 0) INTO v_avail FROM admin_revenue WHERE id = v_rev;
  IF v_avail <> v_avail0 + 500 THEN
    RAISE EXCEPTION '2 expected no second credit, available is %', v_avail;
  END IF;

  ---------------------------------------------------------- 3  pending payout
  v_res := fb_record_withdrawal_fee('wd_test2e_pending');
  IF v_res ->> 'status' <> 'not_success' THEN
    RAISE EXCEPTION '3 expected not_success, got %', v_res;
  END IF;
  IF (SELECT fee_credited FROM withdrawals WHERE id = 'wd_test2e_pending') THEN
    RAISE EXCEPTION '3 pending payout must not be flagged';
  END IF;
  SELECT count(*) INTO v_count FROM admin_revenue_entries WHERE withdrawal_id = 'wd_test2e_pending';
  IF v_count <> 0 THEN
    RAISE EXCEPTION '3 pending payout must not write a ledger row';
  END IF;

  -------------------------------------------------------------- 4  zero fee
  v_res := fb_record_withdrawal_fee('wd_test2e_zero');
  IF v_res ->> 'status' <> 'nothing_to_credit' THEN
    RAISE EXCEPTION '4 expected nothing_to_credit, got %', v_res;
  END IF;

  --------------------------------------------------- 5  unknown and empty id
  v_res := fb_record_withdrawal_fee('wd_test2e_missing');
  IF v_res ->> 'status' <> 'not_found' THEN
    RAISE EXCEPTION '5 expected not_found, got %', v_res;
  END IF;
  v_res := fb_record_withdrawal_fee('');
  IF v_res ->> 'status' <> 'invalid_withdrawal' THEN
    RAISE EXCEPTION '5 expected invalid_withdrawal, got %', v_res;
  END IF;

  ------------------------------------------------- 6  ledger row without flag
  INSERT INTO admin_revenue_entries (id, kind, withdrawal_id, amount)
  VALUES ('wfe_wd_test2e_healed', 'withdrawal_fee', 'wd_test2e_healed', 300);
  v_res := fb_record_withdrawal_fee('wd_test2e_healed');
  IF v_res ->> 'status' <> 'already_credited' THEN
    RAISE EXCEPTION '6 expected already_credited, got %', v_res;
  END IF;
  IF COALESCE((v_res ->> 'healed_flag')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION '6 expected healed_flag true, got %', v_res;
  END IF;
  IF NOT (SELECT fee_credited FROM withdrawals WHERE id = 'wd_test2e_healed') THEN
    RAISE EXCEPTION '6 expected the flag healed to true';
  END IF;
  SELECT count(*) INTO v_count FROM admin_revenue_entries WHERE withdrawal_id = 'wd_test2e_healed';
  IF v_count <> 1 THEN
    RAISE EXCEPTION '6 expected one ledger row, found %', v_count;
  END IF;

  -------------------------------------------------------------- final totals
  SELECT COALESCE(total_revenue, 0), COALESCE(available_balance, 0)
    INTO v_total, v_avail
    FROM admin_revenue WHERE id = v_rev;
  IF v_total <> v_total0 + 500 THEN
    RAISE EXCEPTION 'final total_revenue drifted: expected % got %', v_total0 + 500, v_total;
  END IF;
  IF v_avail <> v_avail0 + 500 THEN
    RAISE EXCEPTION 'final available_balance drifted: expected % got %', v_avail0 + 500, v_avail;
  END IF;
END
$test$;

SELECT '2e withdrawal fee credit: all checks passed' AS result;

ROLLBACK;
