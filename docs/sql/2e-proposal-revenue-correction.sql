-- ============================================================================
-- Batch 2e — PROPOSAL ONLY. NOT EXECUTED. Do not run this as shipped.
-- ============================================================================
-- This is the correcting entry for the unexplained admin revenue remainder
-- described in docs/ADMIN_REVENUE_RECONCILIATION.md (section 6).
--
-- As written, running this file performs NO writes: every mutation is commented
-- out on purpose. It exists so you can review the exact statement, fill in the
-- amount from the read-only diagnosis, and uncomment it yourself.
--
-- WHY A CORRECTION IS NEEDED AT ALL
--   The ledger carries service fee revenue for orders that are not (or are no
--   longer) paid, so total_revenue and available_balance are optimistic. The
--   analytics already refuse to count those fees, which is why the derived
--   figure is lower. This entry takes the over-credit back out.
--
-- WHEN NOT TO RUN IT
--   * if the diagnosis (R3 + R4) does not name an amount within N1 of the gap
--   * if the remainder turns out to be duplicate crediting (R5) — that needs its
--     own per-row review, not one lump correction
--   * if you would rather leave history untouched and only fix it forward. That
--     is a legitimate choice: nothing in the platform is broken by it, and the
--     "Ledger vs derived" card will keep showing the remainder.
-- ============================================================================


-- ============================================================================
-- STEP 1 — DIAGNOSIS (read-only). Copy the number this prints into STEP 3.
-- ============================================================================

-- 1.1 The over-credited service fees: fee rows on orders that are not paid.
SELECT 'unpaid_orders' AS cause,
       count(*)::int AS orders,
       COALESCE(sum(osf.service_fee_amount), 0)::numeric AS amount
  FROM order_service_fees osf
  JOIN orders o ON o.id = osf.order_id
 WHERE o.payment_status NOT IN ('paid', 'completed')
 GROUP BY 1
UNION ALL
-- 1.2 Fees that stayed on orders refunded after payment.
SELECT 'refunded_orders' AS cause,
       count(*)::int AS orders,
       COALESCE(sum(o.service_fee_amount), 0)::numeric AS amount
  FROM orders o
 WHERE EXISTS (
         SELECT 1 FROM refunds r
          WHERE r.order_id = o.id AND lower(r.status::text) = 'processed'
       )
 GROUP BY 1;

-- 1.3 The live gap, so you can compare.
SELECT e.kind,
       count(*)::int AS rows,
       sum(e.amount)::numeric AS ledger_amount
  FROM admin_revenue_entries e
 GROUP BY e.kind
 ORDER BY abs(sum(e.amount)) DESC;

SELECT COALESCE(total_revenue, 0)::numeric     AS ledger_total_revenue,
       COALESCE(available_balance, 0)::numeric AS ledger_available
  FROM admin_revenue
 ORDER BY updated_at NULLS LAST, id
 LIMIT 1;


-- ============================================================================
-- STEP 2 — PREVIEW the correction without applying it.
--   Replace :amount and :reason below, then run ONLY this SELECT to see the
--   before/after. It writes nothing.
-- ============================================================================

/*
WITH params AS (
  SELECT :amount::numeric AS amount,   -- e.g. 2476.00, taken from STEP 1
         :'reason'::text  AS reason    -- e.g. 'service fees on unpaid orders'
)
SELECT r.id,
       COALESCE(r.total_revenue, 0)::numeric     AS total_revenue_before,
       (COALESCE(r.total_revenue, 0) - p.amount)::numeric     AS total_revenue_after,
       COALESCE(r.available_balance, 0)::numeric AS available_before,
       (COALESCE(r.available_balance, 0) - p.amount)::numeric AS available_after,
       p.reason
  FROM admin_revenue r, params p
 ORDER BY r.updated_at NULLS LAST, r.id
 LIMIT 1;
*/


-- ============================================================================
-- STEP 3 — THE CORRECTION. Commented out. Uncomment deliberately, once.
-- ============================================================================
-- Idempotent: the ledger id 'adj_2e_recon_<label>' is the guard, so a second run
-- does nothing. Replace both :amount and :label before uncommenting.

/*
BEGIN;

DO $adj$
DECLARE
  v_amount numeric := :amount;          -- e.g. 2476.00
  v_label  text    := :'label';         -- e.g. '2026-11-unpaid-service-fees'
  v_id     text    := 'adj_2e_recon_' || :'label';
  v_rev    text;
  v_have   integer;
BEGIN
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RAISE EXCEPTION 'set a positive amount before running this correction';
  END IF;

  SELECT count(*) INTO v_have FROM admin_revenue_entries WHERE id = v_id;
  IF v_have > 0 THEN
    RAISE NOTICE 'correction % already applied; nothing to do', v_id;
    RETURN;
  END IF;

  SELECT id INTO v_rev FROM admin_revenue ORDER BY updated_at NULLS LAST, id LIMIT 1 FOR UPDATE;
  IF v_rev IS NULL THEN
    RAISE EXCEPTION 'no admin_revenue row';
  END IF;

  -- Ledger first: its primary key is the idempotency guard.
  INSERT INTO admin_revenue_entries (id, kind, withdrawal_id, amount)
  VALUES (v_id, 'adjustment', NULL, -v_amount);

  UPDATE admin_revenue
     SET total_revenue     = COALESCE(total_revenue, 0)     - v_amount,
         available_balance = COALESCE(available_balance, 0) - v_amount,
         updated_at        = now()
   WHERE id = v_rev;

  RAISE NOTICE 'correction % applied: -% to total_revenue and available_balance', v_id, v_amount;
END
$adj$;

COMMIT;
*/

-- ============================================================================
-- STEP 4 — VERIFY after applying: the gap should be within N1.
-- ============================================================================
SELECT COALESCE(sum(amount), 0)::numeric AS ledger_total_after
  FROM admin_revenue_entries;
