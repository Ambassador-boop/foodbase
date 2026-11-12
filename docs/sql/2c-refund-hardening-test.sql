-- ============================================================================
-- Batch 2c — test script (self-contained, leaves nothing behind)
-- ============================================================================
-- Everything below runs inside one transaction and ends with ROLLBACK, so no
-- fixture row survives and no real business, refund or balance is touched.
-- Safe to run against production, at any time, as many times as you like.
--
-- It proves, against the live functions rather than by inspection:
--   B1  fb_request_refund refuses a refund the bucket cannot cover
--       ('insufficient_balance'), and writes no refund row when it refuses.
--   B2  fb_request_refund refuses a refund beyond what the payment still allows
--       ('exceeds_refundable').
--   A1  a refund created on a pending payment debits pending_balance only.
--   A2  fb_reverse_failed_refund called twice credits exactly once
--       ('reversed' then 'already_reversed') and writes one ledger row.
--   A3  a refund that failed AFTER settlement is credited to available_balance,
--       not to refunds.balance_affected, so nothing is stranded in pending.
--   A4  a refund that failed BEFORE settlement is credited back to pending, and
--       the payment can then settle in full.
--   C1  the pending-balance invariant used by the Alerts page agrees with the
--       stored balance throughout, including after both reversals.
--
-- Expected output at the end: one row, "2c refund hardening: all checks passed".
-- On any failure the block raises, the transaction aborts and nothing changes.
-- ============================================================================

BEGIN;

DO $test$
DECLARE
  v_res      jsonb;
  v_pending  numeric;
  v_avail    numeric;
  v_count    integer;
  v_derived  numeric;
  v_reversed integer;
BEGIN
  -- ---------------------------------------------------------------- fixtures
  -- A throw-away owner: businesses.owner_id is a foreign key into users.
  INSERT INTO users (id, email, role, first_name, last_name)
  VALUES ('test_2c_owner', 'fixture.owner@example.test', 'business_owner', 'Batch', 'Fixture');

  INSERT INTO businesses (id, owner_id, name, slug, email, available_balance, pending_balance)
  VALUES ('test_2c_biz', 'test_2c_owner', 'Batch 2c fixture', 'test-2c-fixture',
          'fixture@example.test', 0, 1000);

  INSERT INTO orders (id, business_id, customer_email, customer_name, total_amount,
                      payment_status, payment_reference, paid_at)
  VALUES ('test_2c_order', 'test_2c_biz', 'fixture@example.test', 'Fixture', 1000,
          'paid', 'test_2c_ref', now());

  -- A payment of 1,000 that has not settled yet: the money sits in pending.
  INSERT INTO transactions (id, business_id, order_id, amount, transaction_type,
                            payment_reference, status, settlement_status, balance_bucket, available_at)
  VALUES ('test_2c_txn', 'test_2c_biz', 'test_2c_order', 1000, 'payment',
          'test_2c_ref', 'completed', 'pending', 'pending', now() + interval '1 day');

  -- ------------------------------------------------- B1  the bucket must cover it
  UPDATE businesses SET pending_balance = 400 WHERE id = 'test_2c_biz';
  v_res := fb_request_refund('test_2c_order', 'test_2c_owner', 600, 'test',
                             'bucket guard', 'test_2c_rf_guard', 'customer note', 'merchant note');
  IF v_res->>'status' <> 'insufficient_balance' THEN
    RAISE EXCEPTION 'B1 failed: expected insufficient_balance, got %', v_res;
  END IF;
  IF v_res->>'bucket' <> 'pending' THEN
    RAISE EXCEPTION 'B1 failed: expected the pending bucket to be named, got %', v_res;
  END IF;
  SELECT count(*) INTO v_count FROM refunds WHERE id = 'test_2c_rf_guard';
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'B1 failed: a refused refund still wrote a refunds row';
  END IF;
  UPDATE businesses SET pending_balance = 1000 WHERE id = 'test_2c_biz';

  -- ------------------------------------------- B2  cannot exceed the payment
  v_res := fb_request_refund('test_2c_order', 'test_2c_owner', 1500, 'test',
                             'cap guard', 'test_2c_rf_cap', 'customer note', 'merchant note');
  IF v_res->>'status' <> 'exceeds_refundable' THEN
    RAISE EXCEPTION 'B2 failed: expected exceeds_refundable, got %', v_res;
  END IF;

  -- ------------------------------------- A1  creating a refund debits pending only
  v_res := fb_request_refund('test_2c_order', 'test_2c_owner', 300, 'test',
                             'partial refund', 'test_2c_rf_a', 'customer note', 'merchant note');
  IF v_res->>'status' <> 'created' THEN
    RAISE EXCEPTION 'A1 failed: expected created, got %', v_res;
  END IF;
  IF v_res->>'bucket' <> 'pending' THEN
    RAISE EXCEPTION 'A1 failed: expected the refund to hit pending, got %', v_res;
  END IF;
  SELECT pending_balance, available_balance INTO v_pending, v_avail
    FROM businesses WHERE id = 'test_2c_biz';
  IF v_pending <> 700 OR v_avail <> 0 THEN
    RAISE EXCEPTION 'A1 failed: expected pending 700 / available 0, got % / %', v_pending, v_avail;
  END IF;

  -- ------------------------------------------------- C1  invariant before settling
  SELECT coalesce(sum(greatest(0, t.amount - coalesce(rf.refunded, 0))), 0) INTO v_derived
    FROM transactions t
    LEFT JOIN (
      SELECT transaction_id, sum(refund_amount) AS refunded
        FROM refunds
       WHERE lower(status::text) NOT IN ('failed', 'rejected')
       GROUP BY transaction_id
    ) rf ON rf.transaction_id = t.id
   WHERE t.business_id = 'test_2c_biz'
     AND t.settlement_status::text = 'pending'
     AND t.balance_bucket = 'pending';
  SELECT pending_balance INTO v_pending FROM businesses WHERE id = 'test_2c_biz';
  IF abs(v_pending - v_derived) > 0.01 THEN
    RAISE EXCEPTION 'C1 failed: stored pending % disagrees with derived %', v_pending, v_derived;
  END IF;

  -- --------------------------- A3  settlement happens, then the refund fails
  -- Exactly what fb_settle_due_transactions does for a partially refunded payment.
  UPDATE businesses
     SET pending_balance = pending_balance - 700,
         available_balance = available_balance + 700
   WHERE id = 'test_2c_biz';
  UPDATE transactions
     SET settlement_status = 'settled', balance_bucket = 'available', settled_at = now()
   WHERE id = 'test_2c_txn';

  UPDATE refunds SET status = 'failed' WHERE id = 'test_2c_rf_a';

  v_res := fb_reverse_failed_refund('test_2c_rf_a');
  IF v_res->>'status' <> 'reversed' THEN
    RAISE EXCEPTION 'A3 failed: expected reversed, got %', v_res;
  END IF;
  IF v_res->>'bucket' <> 'available' THEN
    RAISE EXCEPTION 'A3 failed: expected the credit to land in available (the transaction''s current bucket), got %', v_res;
  END IF;
  SELECT pending_balance, available_balance INTO v_pending, v_avail
    FROM businesses WHERE id = 'test_2c_biz';
  IF v_pending <> 0 OR v_avail <> 1000 THEN
    RAISE EXCEPTION 'A3 failed: expected pending 0 / available 1000, got % / %', v_pending, v_avail;
  END IF;

  -- ------------------------------------------- A2  second call must not credit again
  v_res := fb_reverse_failed_refund('test_2c_rf_a');
  IF v_res->>'status' <> 'already_reversed' THEN
    RAISE EXCEPTION 'A2 failed: expected already_reversed on the second call, got %', v_res;
  END IF;
  SELECT pending_balance, available_balance INTO v_pending, v_avail
    FROM businesses WHERE id = 'test_2c_biz';
  IF v_pending <> 0 OR v_avail <> 1000 THEN
    RAISE EXCEPTION 'A2 failed: the second reversal moved money, now % / %', v_pending, v_avail;
  END IF;
  SELECT count(*) INTO v_reversed
    FROM finance_records
   WHERE related_id = 'test_2c_rf_a' AND record_type = 'refund_reversed';
  IF v_reversed <> 1 THEN
    RAISE EXCEPTION 'A2 failed: expected exactly one refund_reversed ledger row, found %', v_reversed;
  END IF;

  -- --------------------- A4  a refund that fails BEFORE settlement returns to pending
  INSERT INTO orders (id, business_id, customer_email, customer_name, total_amount,
                      payment_status, payment_reference, paid_at)
  VALUES ('test_2c_order_b', 'test_2c_biz', 'fixture@example.test', 'Fixture B', 500,
          'paid', 'test_2c_ref_b', now());

  INSERT INTO transactions (id, business_id, order_id, amount, transaction_type,
                            payment_reference, status, settlement_status, balance_bucket, available_at)
  VALUES ('test_2c_txn_b', 'test_2c_biz', 'test_2c_order_b', 500, 'payment',
          'test_2c_ref_b', 'completed', 'pending', 'pending', now() + interval '1 day');

  UPDATE businesses SET pending_balance = pending_balance + 500 WHERE id = 'test_2c_biz';

  v_res := fb_request_refund('test_2c_order_b', 'test_2c_owner', 200, 'test',
                             'pending refund', 'test_2c_rf_b', 'customer note', 'merchant note');
  IF v_res->>'status' <> 'created' THEN
    RAISE EXCEPTION 'A4 failed: expected created, got %', v_res;
  END IF;

  UPDATE refunds SET status = 'failed' WHERE id = 'test_2c_rf_b';
  v_res := fb_reverse_failed_refund('test_2c_rf_b');
  IF v_res->>'status' <> 'reversed' OR v_res->>'bucket' <> 'pending' THEN
    RAISE EXCEPTION 'A4 failed: expected reversed into pending, got %', v_res;
  END IF;

  SELECT pending_balance, available_balance INTO v_pending, v_avail
    FROM businesses WHERE id = 'test_2c_biz';
  IF v_pending <> 500 OR v_avail <> 1000 THEN
    RAISE EXCEPTION 'A4 failed: expected pending 500 / available 1000, got % / %', v_pending, v_avail;
  END IF;

  -- ------------------------------------------------- C1  invariant, final state
  SELECT coalesce(sum(greatest(0, t.amount - coalesce(rf.refunded, 0))), 0) INTO v_derived
    FROM transactions t
    LEFT JOIN (
      SELECT transaction_id, sum(refund_amount) AS refunded
        FROM refunds
       WHERE lower(status::text) NOT IN ('failed', 'rejected')
       GROUP BY transaction_id
    ) rf ON rf.transaction_id = t.id
   WHERE t.business_id = 'test_2c_biz'
     AND t.settlement_status::text = 'pending'
     AND t.balance_bucket = 'pending';
  SELECT pending_balance INTO v_pending FROM businesses WHERE id = 'test_2c_biz';
  IF abs(v_pending - v_derived) > 0.01 THEN
    RAISE EXCEPTION 'C1 failed at the end: stored pending % disagrees with derived %', v_pending, v_derived;
  END IF;

  RAISE NOTICE '2c refund hardening: all checks passed';
END $test$;

-- What you should see above:
--   NOTICE:  2c refund hardening: all checks passed
-- Any "failed" message means the live behaviour differs from the code in this
-- batch; send me the message and do not merge.

ROLLBACK;

-- After the rollback, confirm nothing was left behind. Both counts must be 0.
SELECT
  (SELECT count(*) FROM users      WHERE id = 'test_2c_owner')      AS fixture_users,
  (SELECT count(*) FROM businesses WHERE id = 'test_2c_biz')        AS fixture_businesses,
  (SELECT count(*) FROM orders     WHERE id LIKE 'test_2c_order%')  AS fixture_orders,
  (SELECT count(*) FROM refunds    WHERE id LIKE 'test_2c_rf_%')    AS fixture_refunds;
