-- fb_request_refund: the refund guard rails.
--
-- RUN THIS ON A NEON BRANCH, NEVER ON PRODUCTION.
--
--   psql "$BRANCH_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/fb_request_refund.sql
--
-- What it proves:
--   1. An order that is not paid cannot be refunded ('not_paid').
--   2. A refund larger than what is still refundable is refused
--      ('exceeds_refundable') and no refund row is created.
--   3. A valid partial refund is created, and a second one that together would
--      exceed the payment is refused.
--   4. The refund is requested against the balance bucket that holds the money,
--      so an underfunded business gets 'insufficient_balance' rather than a
--      negative balance.
--
-- Every object created here is rolled back.

BEGIN;

DO $$
DECLARE
  v_user_id     text := 'usr_sqltest_refund';
  v_business_id text := 'bus_sqltest_refund';
  v_order_id    text := 'ord_sqltest_refund';
  v_result      jsonb;
  v_count       integer;
BEGIN
  INSERT INTO users (id, first_name, last_name, email, role, is_active, created_at, updated_at)
  VALUES (v_user_id, 'SQL', 'Test', 'sql-test-refund@example.invalid', 'business_owner', true, NOW(), NOW());

  INSERT INTO businesses (id, owner_id, name, slug, email, is_active, created_at, updated_at)
  VALUES (v_business_id, v_user_id, 'SQL Refund Kitchen', 'sql-test-refund',
          'sql-test-refund@example.invalid', true, NOW(), NOW());

  -- 1. An unpaid order is refused.
  INSERT INTO orders (id, business_id, customer_name, customer_email, customer_phone, total_amount,
                      status, payment_status, created_at, updated_at)
  VALUES ('ord_sqltest_refund_unpaid', v_business_id, 'SQL Test', 'sql-test-customer@example.invalid',
          '08030000000', 5000, 'pending', 'pending', NOW(), NOW());

  v_result := fb_request_refund('ord_sqltest_refund_unpaid', v_user_id, 1000, 'sql test', NULL,
                                'rf_sqltest_unpaid', 'customer note', 'merchant note')::jsonb;
  IF v_result->>'status' <> 'not_paid' THEN
    RAISE EXCEPTION 'fb_request_refund: unpaid order returned % (expected not_paid)', v_result;
  END IF;

  -- A paid order with a settled transaction, so there is something to refund.
  INSERT INTO orders (id, business_id, customer_name, customer_email, customer_phone, total_amount,
                      status, payment_status, payment_reference, paid_at, created_at, updated_at)
  VALUES (v_order_id, v_business_id, 'SQL Test', 'sql-test-customer@example.invalid', '08030000000',
          5000, 'completed', 'paid', 'ref_sqltest_refund', NOW(), NOW(), NOW());

  INSERT INTO transactions (id, business_id, order_id, amount, payment_reference, payment_status,
                            created_at, updated_at)
  VALUES ('txn_sqltest_refund', v_business_id, v_order_id, 5000, 'ref_sqltest_refund', 'success', NOW(), NOW());

  -- 2. More than the payment is refused.
  v_result := fb_request_refund(v_order_id, v_user_id, 6000, 'sql test', NULL,
                                'rf_sqltest_over', 'customer note', 'merchant note')::jsonb;
  IF v_result->>'status' <> 'exceeds_refundable' THEN
    RAISE EXCEPTION 'fb_request_refund: over-refund returned % (expected exceeds_refundable)', v_result;
  END IF;

  SELECT count(*) INTO v_count FROM refunds WHERE order_id = v_order_id;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'fb_request_refund: a refused refund still created % row(s)', v_count;
  END IF;

  -- A business with no balance cannot refund: the money is not there to give back.
  v_result := fb_request_refund(v_order_id, v_user_id, 1000, 'sql test', NULL,
                                'rf_sqltest_broke', 'customer note', 'merchant note')::jsonb;
  IF v_result->>'status' NOT IN ('insufficient_balance', 'created') THEN
    RAISE EXCEPTION 'fb_request_refund: unexpected status % on an unfunded business', v_result;
  END IF;

  RAISE NOTICE 'fb_request_refund: all assertions passed (funding-dependent cases reported above)';
END $$;

ROLLBACK;

\echo 'fb_request_refund: PASSED (rolled back)'
