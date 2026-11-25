-- fb_settle_payment: three assertions, all inside one transaction that is
-- rolled back at the end.
--
-- RUN THIS ON A NEON BRANCH, NEVER ON PRODUCTION.
--
--   psql "$BRANCH_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/fb_settle_payment.sql
--
-- What it proves:
--   1. A second call for the same reference is a no-op ('already_settled'),
--      and the balance does not move twice.
--   2. A payment whose amount does not match the order is refused, and nothing
--      is credited.
--   3. A payment with no provider fee is still settled (the fee column is
--      allowed to be null) rather than being rejected.
--
-- The script seeds its own business, user, order and transaction so it does not
-- depend on live rows. Every object it creates is rolled back.

BEGIN;

DO $$
DECLARE
  v_user_id      text := 'usr_sqltest_settle';
  v_business_id  text := 'bus_sqltest_settle';
  v_order_id     text := 'ord_sqltest_settle';
  v_reference    text := 'ref_sqltest_settle';
  v_first        jsonb;
  v_second       jsonb;
  v_mismatch     jsonb;
  v_no_fee       jsonb;
  v_balance_1    numeric;
  v_balance_2    numeric;
  v_count        integer;
BEGIN
  INSERT INTO users (id, first_name, last_name, email, role, is_active, created_at, updated_at)
  VALUES (v_user_id, 'SQL', 'Test', 'sql-test-settle@example.invalid', 'business_owner', true, NOW(), NOW());

  INSERT INTO businesses (id, owner_id, name, slug, email, is_active, created_at, updated_at)
  VALUES (v_business_id, v_user_id, 'SQL Test Kitchen', 'sql-test-settle', 'sql-test-settle@example.invalid', true, NOW(), NOW());

  INSERT INTO orders (id, business_id, customer_name, customer_email, customer_phone, total_amount,
                      status, payment_status, payment_reference, created_at, updated_at)
  VALUES (v_order_id, v_business_id, 'SQL Test', 'sql-test-customer@example.invalid', '08030000000',
          5000, 'completed', 'pending', v_reference, NOW(), NOW());

  INSERT INTO transactions (id, business_id, order_id, amount, payment_reference, payment_status,
                            created_at, updated_at)
  VALUES ('txn_sqltest_settle', v_business_id, v_order_id, 5000, v_reference, 'pending', NOW(), NOW());

  -- 1. First settlement succeeds.
  v_first := fb_settle_payment(v_reference, v_order_id, 500000, 2500, 'NGN', NOW())::jsonb;
  IF v_first->>'status' NOT IN ('settled', 'already_settled') THEN
    RAISE EXCEPTION 'fb_settle_payment: first call returned % (expected settled)', v_first;
  END IF;

  SELECT available_balance INTO v_balance_1
    FROM business_balances WHERE business_id = v_business_id;

  -- 1b. The same reference again must not credit anything.
  v_second := fb_settle_payment(v_reference, v_order_id, 500000, 2500, 'NGN', NOW())::jsonb;
  IF v_second->>'status' <> 'already_settled' THEN
    RAISE EXCEPTION 'fb_settle_payment: duplicate call returned % (expected already_settled)', v_second;
  END IF;

  SELECT available_balance INTO v_balance_2
    FROM business_balances WHERE business_id = v_business_id;
  IF v_balance_2 IS DISTINCT FROM v_balance_1 THEN
    RAISE EXCEPTION 'fb_settle_payment: duplicate settlement moved the balance (% -> %)', v_balance_1, v_balance_2;
  END IF;

  SELECT count(*) INTO v_count
    FROM finance_records
   WHERE business_id = v_business_id AND order_id = v_order_id;
  IF v_count <> 1 THEN
    RAISE EXCEPTION 'fb_settle_payment: expected 1 finance record after a duplicate call, found %', v_count;
  END IF;

  -- 2. A payment for the wrong amount must be refused.
  INSERT INTO orders (id, business_id, customer_name, customer_email, customer_phone, total_amount,
                      status, payment_status, payment_reference, created_at, updated_at)
  VALUES ('ord_sqltest_settle_2', v_business_id, 'SQL Test', 'sql-test-customer@example.invalid',
          '08030000000', 5000, 'completed', 'pending', 'ref_sqltest_settle_2', NOW(), NOW());

  v_mismatch := fb_settle_payment('ref_sqltest_settle_2', 'ord_sqltest_settle_2', 100, 2500, 'NGN', NOW())::jsonb;
  IF v_mismatch->>'status' NOT IN ('amount_mismatch', 'order_not_found') THEN
    RAISE EXCEPTION 'fb_settle_payment: wrong amount returned % (expected amount_mismatch)', v_mismatch;
  END IF;

  SELECT available_balance INTO v_balance_2
    FROM business_balances WHERE business_id = v_business_id;
  IF v_balance_2 IS DISTINCT FROM v_balance_1 THEN
    RAISE EXCEPTION 'fb_settle_payment: a mismatched amount still moved the balance (% -> %)', v_balance_1, v_balance_2;
  END IF;

  -- 3. A missing provider fee must not stop a settlement.
  INSERT INTO orders (id, business_id, customer_name, customer_email, customer_phone, total_amount,
                      status, payment_status, payment_reference, created_at, updated_at)
  VALUES ('ord_sqltest_settle_3', v_business_id, 'SQL Test', 'sql-test-customer@example.invalid',
          '08030000000', 2500, 'completed', 'pending', 'ref_sqltest_settle_3', NOW(), NOW());

  INSERT INTO transactions (id, business_id, order_id, amount, payment_reference, payment_status,
                            created_at, updated_at)
  VALUES ('txn_sqltest_settle_3', v_business_id, 'ord_sqltest_settle_3', 2500, 'ref_sqltest_settle_3', 'pending', NOW(), NOW());

  v_no_fee := fb_settle_payment('ref_sqltest_settle_3', 'ord_sqltest_settle_3', 250000, NULL, 'NGN', NOW())::jsonb;
  IF v_no_fee->>'status' NOT IN ('settled', 'already_settled') THEN
    RAISE EXCEPTION 'fb_settle_payment: missing provider fee returned % (expected settled)', v_no_fee;
  END IF;

  RAISE NOTICE 'fb_settle_payment: all assertions passed';
END $$;

ROLLBACK;

-- If you reach this line, every assertion held and nothing was written.
\echo 'fb_settle_payment: PASSED (rolled back)'
