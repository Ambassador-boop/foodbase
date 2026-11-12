-- ============================================================================
-- Batch 2d — test script (self-contained, leaves nothing behind)
-- ============================================================================
-- Everything runs inside one transaction and ends with ROLLBACK. Fixtures are
-- admin_transfers rows and ledger entries with a test_ prefix; no real transfer,
-- balance or revenue row is left changed. Safe to run on production.
--
-- It proves, against the live function:
--   1  a successful transfer records the fee once: provider_fee, one
--      'provider_fee' ledger row at -fee, available_balance -fee, expenses +fee
--   2  a second call is a no-op ('already_recorded'), even with a different fee
--   3  a pending transfer records nothing ('not_success')
--   4  a zero fee records nothing ('nothing_to_record')
--   5  a negative fee is refused ('invalid_fee')
--   6  an unknown or empty transfer id is refused ('not_found' / 'invalid_transfer')
--   7  fb_admin_reverse_transfer returns the transfer amount to available_balance
--      and removes it from expenses_amount, and does NOT touch the fee
--
-- Expected output at the end: one row, "2d transfer fee: all checks passed".
-- ============================================================================

BEGIN;

DO $test$
DECLARE
  v_rev     text;
  v_avail0  numeric;
  v_exp0    numeric;
  v_avail   numeric;
  v_exp    numeric;
  v_res     jsonb;
  v_count   integer;
  v_amount  numeric;
BEGIN
  -- The revenue row the functions will pick (same ORDER BY they use).
  SELECT id, COALESCE(available_balance, 0), COALESCE(expenses_amount, 0)
    INTO v_rev, v_avail0, v_exp0
    FROM admin_revenue
   ORDER BY updated_at NULLS LAST, id
   LIMIT 1;
  IF v_rev IS NULL THEN
    RAISE EXCEPTION 'no admin_revenue row to test against';
  END IF;
  SELECT count(*) INTO v_count FROM admin_revenue;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'this test expects exactly one admin_revenue row, found %', v_count;
  END IF;

  INSERT INTO admin_transfers
    (id, kind, amount, status, reference, bank_code, account_number, account_name,
     balance_deducted, balance_reversed, provider_fee)
  VALUES
    ('at_test2d_ok', 'sms_funding', 10000, 'success', 'test_2d_ref_ok',
     '000', '0000000000', 'Batch 2d fixture', true, false, 0),
    ('at_test2d_due', 'sms_funding', 10000, 'pending', 'test_2d_ref_due',
     '000', '0000000000', 'Batch 2d fixture', true, false, 0),
    ('at_test2d_zero', 'sms_funding', 5000, 'success', 'test_2d_ref_zero',
     '000', '0000000000', 'Batch 2d fixture', true, false, 0);

  ---------------------------------------------------------------- 1  record once
  -- ₦10,000 funds: ₦25 transfer fee + ₦50 stamp duty = ₦75, the figure
  -- lib/paystack-fees.ts computes for that amount.
  v_res := fb_admin_record_transfer_fee('at_test2d_ok', 75, 'computed');
  IF v_res->>'status' <> 'recorded' THEN
    RAISE EXCEPTION '1 failed: expected recorded, got %', v_res;
  END IF;
  IF (v_res->>'fee')::numeric <> 75 THEN
    RAISE EXCEPTION '1 failed: expected the fee echoed as 75, got %', v_res;
  END IF;
  IF (v_res->>'source') <> 'computed' THEN
    RAISE EXCEPTION '1 failed: expected source computed, got %', v_res;
  END IF;

  SELECT COALESCE(provider_fee, 0) INTO v_amount FROM admin_transfers WHERE id = 'at_test2d_ok';
  IF v_amount <> 75 THEN
    RAISE EXCEPTION '1 failed: provider_fee is %, expected 75', v_amount;
  END IF;

  SELECT count(*) INTO v_count
    FROM admin_revenue_entries
   WHERE id = 'are_fee_at_test2d_ok';
  IF v_count <> 1 THEN
    RAISE EXCEPTION '1 failed: expected one ledger row keyed to the transfer, found %', v_count;
  END IF;

  SELECT count(*) INTO v_count
    FROM admin_revenue_entries
   WHERE id = 'are_fee_at_test2d_ok'
     AND kind = 'provider_fee'
     AND withdrawal_id = 'at_test2d_ok'
     AND amount = -75;
  IF v_count <> 1 THEN
    RAISE EXCEPTION '1 failed: the ledger row is not kind provider_fee / -75 / keyed to the transfer';
  END IF;

  SELECT COALESCE(available_balance, 0), COALESCE(expenses_amount, 0)
    INTO v_avail, v_exp
    FROM admin_revenue WHERE id = v_rev;
  IF v_avail <> v_avail0 - 75 THEN
    RAISE EXCEPTION '1 failed: available_balance is %, expected %', v_avail, v_avail0 - 75;
  END IF;
  IF v_exp <> v_exp0 + 75 THEN
    RAISE EXCEPTION '1 failed: expenses_amount is %, expected %', v_exp, v_exp0 + 75;
  END IF;

  ------------------------------------------------------------ 2  second call no-op
  v_res := fb_admin_record_transfer_fee('at_test2d_ok', 500, 'computed');
  IF v_res->>'status' <> 'already_recorded' THEN
    RAISE EXCEPTION '2 failed: expected already_recorded, got %', v_res;
  END IF;
  SELECT COALESCE(available_balance, 0) INTO v_avail FROM admin_revenue WHERE id = v_rev;
  IF v_avail <> v_avail0 - 75 THEN
    RAISE EXCEPTION '2 failed: the second call moved the balance to %', v_avail;
  END IF;
  SELECT COALESCE(provider_fee, 0) INTO v_amount FROM admin_transfers WHERE id = 'at_test2d_ok';
  IF v_amount <> 75 THEN
    RAISE EXCEPTION '2 failed: the second call overwrote provider_fee with %', v_amount;
  END IF;
  SELECT count(*) INTO v_count FROM admin_revenue_entries WHERE withdrawal_id = 'at_test2d_ok';
  IF v_count <> 1 THEN
    RAISE EXCEPTION '2 failed: expected one ledger row for the transfer, found %', v_count;
  END IF;

  ------------------------------------------------------- 3  pending records nothing
  v_res := fb_admin_record_transfer_fee('at_test2d_due', 75, 'computed');
  IF v_res->>'status' <> 'not_success' THEN
    RAISE EXCEPTION '3 failed: expected not_success, got %', v_res;
  END IF;
  SELECT COALESCE(provider_fee, 0) INTO v_amount FROM admin_transfers WHERE id = 'at_test2d_due';
  IF v_amount <> 0 THEN
    RAISE EXCEPTION '3 failed: a pending transfer recorded a fee of %', v_amount;
  END IF;
  SELECT count(*) INTO v_count FROM admin_revenue_entries WHERE withdrawal_id = 'at_test2d_due';
  IF v_count <> 0 THEN
    RAISE EXCEPTION '3 failed: a pending transfer wrote a ledger row';
  END IF;

  ------------------------------------------------------------ 4  zero fee refused
  v_res := fb_admin_record_transfer_fee('at_test2d_zero', 0, 'computed');
  IF v_res->>'status' <> 'nothing_to_record' THEN
    RAISE EXCEPTION '4 failed: expected nothing_to_record, got %', v_res;
  END IF;

  ------------------------------------------------------- 5  negative fee refused
  v_res := fb_admin_record_transfer_fee('at_test2d_zero', -5, 'computed');
  IF v_res->>'status' <> 'invalid_fee' THEN
    RAISE EXCEPTION '5 failed: expected invalid_fee, got %', v_res;
  END IF;
  SELECT count(*) INTO v_count FROM admin_revenue_entries WHERE withdrawal_id = 'at_test2d_zero';
  IF v_count <> 0 THEN
    RAISE EXCEPTION '5 failed: a refused fee still wrote a ledger row';
  END IF;

  ------------------------------------------------------------ 6  bad identifiers
  v_res := fb_admin_record_transfer_fee('at_does_not_exist', 75, 'computed');
  IF v_res->>'status' <> 'not_found' THEN
    RAISE EXCEPTION '6 failed: expected not_found, got %', v_res;
  END IF;
  v_res := fb_admin_record_transfer_fee('', 75, 'computed');
  IF v_res->>'status' <> 'invalid_transfer' THEN
    RAISE EXCEPTION '6 failed: expected invalid_transfer, got %', v_res;
  END IF;

  ------------------------------- 7  a reversal returns the amount, never the fee
  UPDATE admin_transfers SET status = 'reversed' WHERE id = 'at_test2d_ok';
  v_res := fb_admin_reverse_transfer('at_test2d_ok');
  IF v_res->>'status' <> 'reversed' THEN
    RAISE EXCEPTION '7 failed: expected reversed, got %', v_res;
  END IF;

  SELECT COALESCE(available_balance, 0), COALESCE(expenses_amount, 0)
    INTO v_avail, v_exp
    FROM admin_revenue WHERE id = v_rev;
  IF v_avail <> v_avail0 - 75 + 10000 THEN
    RAISE EXCEPTION '7 failed: available_balance is %, expected % (amount back, fee kept)', v_avail, v_avail0 - 75 + 10000;
  END IF;
  IF v_exp <> v_exp0 + 75 - 10000 THEN
    RAISE EXCEPTION '7 failed: expenses_amount is %, expected %', v_exp, v_exp0 + 75 - 10000;
  END IF;

  SELECT COALESCE(provider_fee, 0) INTO v_amount FROM admin_transfers WHERE id = 'at_test2d_ok';
  IF v_amount <> 75 THEN
    RAISE EXCEPTION '7 failed: the reversal cleared the recorded fee (now %)', v_amount;
  END IF;
  SELECT count(*) INTO v_count
    FROM admin_revenue_entries
   WHERE id = 'are_fee_at_test2d_ok' AND amount = -75;
  IF v_count <> 1 THEN
    RAISE EXCEPTION '7 failed: the fee ledger row did not survive the reversal';
  END IF;

  -- A second reversal must not move anything.
  v_res := fb_admin_reverse_transfer('at_test2d_ok');
  IF v_res->>'status' <> 'already_reversed' THEN
    RAISE EXCEPTION '7 failed: expected already_reversed on the second call, got %', v_res;
  END IF;

  RAISE NOTICE '2d transfer fee: all checks passed';
END $test$;

-- What you should see above:
--   NOTICE:  2d transfer fee: all checks passed
-- Any "failed" message means the live behaviour differs from this batch; send me
-- the message and do not merge.

ROLLBACK;

-- After the rollback, every count below must be 0.
SELECT
  (SELECT count(*) FROM admin_transfers        WHERE id LIKE 'at_test2d_%')        AS fixture_transfers,
  (SELECT count(*) FROM admin_revenue_entries  WHERE id LIKE 'are_fee_at_test2d_%') AS fixture_fee_entries,
  (SELECT count(*) FROM admin_revenue_entries  WHERE withdrawal_id LIKE 'at_test2d_%') AS fixture_ledger_rows;
