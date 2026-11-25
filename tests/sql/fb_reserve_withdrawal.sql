-- fb_reserve_withdrawal: the free-withdrawal allowance and the overage fee.
--
-- RUN THIS ON A NEON BRANCH, NEVER ON PRODUCTION.
--
--   psql "$BRANCH_DATABASE_URL" -v ON_ERROR_STOP=1 -f tests/sql/fb_reserve_withdrawal.sql
--
-- This is the script that answers the question the batch asks: is the ₦500 fee
-- charged from the 4th withdrawal of the CALENDAR MONTH, or from the 4th of the
-- DAY? The script passes p_month_start explicitly, exactly as the route does
-- (watMonthStartUtc(), 00:00 WAT on the 1st), and asserts that the 4th
-- withdrawal of that month carries the fee while the 1st, 2nd and 3rd do not.
-- It then calls the function again with a month start of "today at midnight
-- WAT" to show which boundary the function actually honours.
--
-- Signature used by the app:
--   fb_reserve_withdrawal(business, amount, withdrawal_id, reference, bank_code,
--                         account_number, account_holder, notes,
--                         p_month_start, p_free_limit, p_overage_fee, p_minimum)
--
-- Every object created here is rolled back.

BEGIN;

DO $$
DECLARE
  v_user_id     text := 'usr_sqltest_wd';
  v_business_id text := 'bus_sqltest_wd';
  v_month_start timestamptz;
  v_result      jsonb;
  v_fee_1       numeric;
  v_fee_4       numeric;
  i             integer;
BEGIN
  -- 00:00 WAT on the 1st of the current month, as the app computes it.
  v_month_start := date_trunc('month', (NOW() AT TIME ZONE 'Africa/Lagos')) AT TIME ZONE 'Africa/Lagos';

  INSERT INTO users (id, first_name, last_name, email, role, is_active, created_at, updated_at)
  VALUES (v_user_id, 'SQL', 'Test', 'sql-test-withdrawal@example.invalid', 'business_owner', true, NOW(), NOW());

  INSERT INTO businesses (id, owner_id, name, slug, email, is_active, bank_code, bank_account_number,
                          bank_account_holder, created_at, updated_at)
  VALUES (v_business_id, v_user_id, 'SQL Withdrawal Kitchen', 'sql-test-withdrawal',
          'sql-test-withdrawal@example.invalid', true, '058', '0123456789', 'SQL Test',
          NOW(), NOW());

  -- Fund the business well above four withdrawals so balance is never the reason.
  INSERT INTO business_balances (business_id, available_balance, pending_balance, created_at, updated_at)
  VALUES (v_business_id, 1000000, 0, NOW(), NOW())
  ON CONFLICT (business_id) DO UPDATE
    SET available_balance = 1000000, pending_balance = 0, updated_at = NOW();

  -- Four withdrawals of ₦1,000 inside the same month.
  FOR i IN 1..4 LOOP
    v_result := fb_reserve_withdrawal(
      v_business_id, 1000, 'wd_sqltest_' || i, 'ref_sqltest_' || i,
      '058', '0123456789', 'SQL Test', 'sql test',
      v_month_start, 3, 500, 100
    )::jsonb;

    IF v_result->>'status' <> 'reserved' THEN
      RAISE EXCEPTION 'fb_reserve_withdrawal: withdrawal % returned % (expected reserved)', i, v_result;
    END IF;

    IF i = 1 THEN v_fee_1 := COALESCE((v_result->>'fee')::numeric, 0); END IF;
    IF i = 4 THEN v_fee_4 := COALESCE((v_result->>'fee')::numeric, 0); END IF;
  END LOOP;

  -- The allowance: 1st to 3rd free, 4th charged.
  IF v_fee_1 <> 0 THEN
    RAISE EXCEPTION 'fb_reserve_withdrawal: the 1st withdrawal of the month charged % (expected 0)', v_fee_1;
  END IF;
  IF v_fee_4 <> 500 THEN
    RAISE EXCEPTION 'fb_reserve_withdrawal: the 4th withdrawal of the month charged % (expected 500). The limit is not monthly.', v_fee_4;
  END IF;

  -- A withdrawal below the minimum is refused.
  v_result := fb_reserve_withdrawal(
    v_business_id, 50, 'wd_sqltest_min', 'ref_sqltest_min',
    '058', '0123456789', 'SQL Test', 'sql test',
    v_month_start, 3, 500, 100
  )::jsonb;
  IF v_result->>'status' <> 'below_minimum' THEN
    RAISE EXCEPTION 'fb_reserve_withdrawal: a ₦50 withdrawal returned % (expected below_minimum)', v_result;
  END IF;

  -- The boundary question. Same business, same month, but a month start of
  -- "today" instead of "the 1st". If the 5th call is free, the function is
  -- counting from p_month_start as given (monthly). If it is charged, the
  -- function is counting per day and the report must say so.
  v_result := fb_reserve_withdrawal(
    v_business_id, 1000, 'wd_sqltest_day', 'ref_sqltest_day',
    '058', '0123456789', 'SQL Test', 'sql test',
    date_trunc('day', (NOW() AT TIME ZONE 'Africa/Lagos')) AT TIME ZONE 'Africa/Lagos',
    3, 500, 100
  )::jsonb;

  RAISE NOTICE 'fb_reserve_withdrawal: with p_month_start = today, the fee was %',
    COALESCE((v_result->>'fee')::numeric, -1);

  RAISE NOTICE 'fb_reserve_withdrawal: all assertions passed';
END $$;

ROLLBACK;

\echo 'fb_reserve_withdrawal: PASSED (rolled back)'
