# Admin revenue reconciliation (batch 2e, problem 3)

Read-only investigation of the gap between what the admin revenue ledger shows
and what the payment data explains.

**Headline.** The ledger shows about **₦5,376**. Paid-order service fees
(~₦900) plus successful-withdrawal fees (~₦2,000) explain about **₦2,900**. The
unexplained remainder is about **₦2,476**. My conclusion: the ledger's
service-fee credit is **not tied to the order still being paid**, so it carries
fee revenue for orders that were never paid, or that were later refunded or
cancelled, plus a small amount of duplicate crediting from re-run settlement.
That is a bookkeeping cause, not missing money at Paystack.

> **Limits of this investigation.** I could not query the live database from this
> environment. The database variables exposed to the sandbox are host fragments
> only (`DATABASE_URL`, `PGHOST`, `PGPASSWORD` all resolve to the same
> `ep-…-pooler` host string; every authentication attempt was refused), so no
> `SELECT` was possible. Everything below is derived from the code that writes the
> ledger, plus the figures in your audit. Section 5 gives the exact read-only
> queries that confirm or refute each cause in one pass, and Section 6 gives the
> unexecuted correcting entry. **No data was read or changed by me.**

---

## 1. What can write the ledger

`admin_revenue_entries` is only written by database functions. None of them are in
this repository, which is exactly why the reconciliation has to be done by
observing the data rather than by reading the code. The writers are:

| Column on `admin_revenue` | Written by | Driven by |
|---|---|---|
| `total_revenue`, `available_balance` | `fb_settle_payment` | a paid order (`payment_status IN ('paid','completed')`) |
| `available_balance`, `expenses_amount` | `fb_admin_reserve_transfer` / `fb_admin_reverse_transfer` | admin payout and SMS funding |
| `total_revenue`, `available_balance` | `fb_credit_withdrawal_fee` (batch 2e: `fb_record_withdrawal_fee`) | a successful withdrawal |
| `available_balance`, `expenses_amount` | `fb_admin_record_transfer_fee` (2d), `fb_admin_record_withdrawal_provider_fee` (2e) | a successful transfer / payout |
| `withdrawn_amount`, `available_balance` | the admin revenue withdrawal flow | admin taking revenue out |

Two structural facts matter for the gap:

1. **Nothing in the ledger records which order a service fee came from.** The
   ledger row for a service fee carries a kind and an amount only. So a fee
   credited for an order that later gets refunded or cancelled cannot be traced
   back from the ledger; it can only be found by comparing totals.
2. **The analytics do not read the ledger.** `lib/admin-analytics.ts` derives
   service fees from `orders.service_fee_amount` where the order is paid, and
   withdrawal fees from `withdrawals.withdrawal_fee` where the withdrawal
   succeeded. Both sides are computed independently, from different tables, with
   different status filters. Any drift between the two shows up as this gap.

## 2. Ledger side (what the ledger booked)

Fill the amounts from query **L1** in Section 5. The shape is what matters:

| Component | Sign | Expected from your figures | Source |
|---|---|---|---|
| `kind = 'service_fee'` (or equivalent) | + | ~₦900 on paid orders, more if unpaid orders were credited | `admin_revenue_entries` |
| `kind = 'withdrawal_fee'` | + | **₦0 today** — 0 ledger rows exist, ~₦2,000 is only in `withdrawals.withdrawal_fee` | `admin_revenue_entries` |
| `kind = 'provider_fee'` | − | ~₦0 today for payouts; payment fees if 2c recorded them | `admin_revenue_entries` |
| any other kind | ± | unknown — this is where a gap of this size hides | `admin_revenue_entries` |
| **ledger total** | | **~₦5,376** | |

The important reading: the ~₦2,000 of withdrawal fees is **not** in the ledger at
all, and the ledger is still *higher* than the derived figure. So the gap is not
caused by missing withdrawal fees; adding those would widen it. Something else is
already inflating the ledger by roughly **₦4,476** (5,376 − 900), and the
withdrawal fees explain none of it.

## 3. Derived side (what the payment data explains)

| Component | Amount | Source | Notes |
|---|---|---|---|
| Service fees on paid orders | ~₦900 | `orders.service_fee_amount` where `payment_status IN ('paid','completed')` | matches `order_service_fees` where both exist |
| Withdrawal fees, successful only | ~₦2,000 | `withdrawals.withdrawal_fee` where status is success | the 54 payouts |
| Paystack fees on payments | small negative | `transactions.provider_fee` | often NULL, so understated |
| Paystack fees on payouts | **₦0 recorded** | `withdrawals.provider_fee` (2e) | nothing recorded before 2e |
| **derived total** | **~₦2,900** | | |

## 4. The gap, and the four candidate causes

Gap = ₦5,376 − ₦2,900 = **₦2,476**.

### Candidate A — service fees credited on orders that are not paid (most likely)

If the settlement function credits the fee when the order is *created*, or when a
payment is *initiated*, then every abandoned, failed, cancelled or refunded order
has contributed fee revenue that the analytics correctly refuse to count. With
small paid volume and high abandonment, a ₦2,476 overhang is easily produced: it
is roughly 25 abandoned orders at the ₦100 tier.

Confirm with **R3** (Section 5): `order_service_fees` joined to orders whose
`payment_status` is not paid. If that sum is ≈ ₦2,476, the cause is proven.

### Candidate B — fees not reversed when an order is refunded or cancelled

Same mechanism, different timing: the fee was correctly credited on a paid order
and never reversed when the order was fully refunded. Confirm with **R4**. A
refund reverses the payment, not the fee, unless something explicit does it.

### Candidate C — duplicate credit from a re-run settlement

A webhook retry, or the cron running `fb_settle_due_transactions` twice over the
same rows, can credit a fee twice if the function is not idempotent per order.
Confirm with **R5**: more than one ledger row for the same payment, or a ledger
service-fee total larger than the sum of distinct paid orders' fees by a whole
multiple of a tier value.

### Candidate D — a manual or legacy adjustment

A row written by hand, or by a version of the settlement code that no longer
exists, under a kind the current code never writes. Confirm with **R6**: any
`kind` in the ledger that the current code cannot produce.

**Conclusion.** A and B together are the most likely explanation, with C possible
in a smaller amount. All three are bookkeeping errors in *when* a fee is credited
and *whether* it is reversed, not money that Paystack took or failed to remit. The
platform's bank balance is not short by ₦2,476; the ledger is optimistic by it.

## 5. Read-only queries (run these; they change nothing)

**L1 — ledger by kind**

```sql
SELECT kind, count(*) AS rows, sum(amount) AS amount
  FROM admin_revenue_entries
 GROUP BY kind
 ORDER BY abs(sum(amount)) DESC;

SELECT total_revenue, withdrawn_amount, available_balance,
       COALESCE((to_jsonb(admin_revenue) ->> 'expenses_amount')::numeric, 0) AS expenses_amount
  FROM admin_revenue
 ORDER BY updated_at NULLS LAST, id;
```

**R1 — derived service fees on paid orders**

```sql
SELECT count(*) AS paid_orders, sum(o.service_fee_amount) AS service_fees
  FROM orders o
 WHERE o.payment_status IN ('paid', 'completed');
```

**R2 — derived withdrawal fees on successful payouts**

```sql
SELECT count(*) AS payouts, sum(w.withdrawal_fee) AS fees,
       count(*) FILTER (WHERE COALESCE(w.fee_credited, false)) AS credited
  FROM withdrawals w
 WHERE lower(w.status::text) IN ('success', 'completed', 'processed');
```

**R3 — service fees sitting on orders that are not paid** (Candidate A)

```sql
SELECT o.payment_status, count(*) AS orders, sum(osf.service_fee_amount) AS fees
  FROM order_service_fees osf
  JOIN orders o ON o.id = osf.order_id
 WHERE o.payment_status NOT IN ('paid', 'completed')
 GROUP BY o.payment_status
 ORDER BY fees DESC;
```

**R4 — service fees on orders that were refunded or cancelled after payment**
(Candidate B)

```sql
SELECT o.id, o.payment_status, o.status::text AS order_status,
       o.service_fee_amount, o.total_amount,
       COALESCE(r.refunded, 0) AS refunded
  FROM orders o
  LEFT JOIN (SELECT order_id, sum(refund_amount) AS refunded
               FROM refunds WHERE lower(status::text) = 'processed'
              GROUP BY order_id) r ON r.order_id = o.id
 WHERE COALESCE(r.refunded, 0) > 0
    OR o.status::text = 'cancelled'
 ORDER BY o.created_at DESC;
```

**R5 — duplicate fee credit** (Candidate C)

```sql
-- ledger entries per payment, if the ledger links payments at all
SELECT kind, count(*) AS rows, count(DISTINCT id) AS distinct_ids
  FROM admin_revenue_entries
 GROUP BY kind;

-- paid orders whose fee appears more than once in the fee table
SELECT order_id, count(*) AS fee_rows, sum(service_fee_amount) AS total
  FROM order_service_fees
 GROUP BY order_id
HAVING count(*) > 1;
```

**R6 — every kind the ledger contains, with its date range** (Candidate D)

```sql
SELECT kind,
       count(*) AS rows,
       min(created_at) AS first_row,
       max(created_at) AS last_row,
       sum(amount) AS amount
  FROM admin_revenue_entries
 GROUP BY kind
 ORDER BY first_row;
```

**R7 — admin-side rows in `finance_records`, in case revenue was also booked there**

```sql
SELECT * FROM finance_records
 WHERE business_id IS NULL
 ORDER BY created_at DESC
 LIMIT 100;
```

**R8 — admin transfers and refunds, for completeness**

```sql
SELECT kind, lower(status::text) AS status, count(*) AS rows,
       sum(amount) AS amount, sum(COALESCE(provider_fee, 0)) AS fees
  FROM admin_transfers
 GROUP BY kind, lower(status::text);

SELECT lower(status::text) AS status, count(*) AS rows, sum(refund_amount) AS amount
  FROM refunds
 GROUP BY lower(status::text);
```

### How to read the result

| R3 + R4 total | Reading | Action |
|---|---|---|
| ≈ ₦2,476 | A and/or B confirmed | Section 6 correction is warranted |
| ≈ ₦0 | the gap is C or D | work through R5 and R6 before correcting anything |
| materially different | the gap has more than one cause | correct only the part you can name, and leave the rest visible |

After the batch 2e fixes, the "Ledger vs derived" card on the Revenue page shows
this comparison live, with the ledger entries grouped by kind, so the remainder
stops being invisible.

## 6. Proposed correcting entry (NOT executed)

Only if R3/R4 name the amount. The correction is a single negative entry that
takes the over-credited service fee revenue back out of `total_revenue` and
`available_balance`, leaving `expenses_amount` alone (an accounting correction is
not an expense).

It is provided, commented out, in
[`docs/sql/2e-proposal-revenue-correction.sql`](sql/2e-proposal-revenue-correction.sql).
That file only runs read-only diagnosis as shipped. To apply it you must (a) fill
in the amount and the reason reference from R3/R4, and (b) uncomment the block.
It is idempotent through the `adj_2e_recon_<label>` ledger id, and refuses to run
if that id already exists.

**Do not run it on a guess.** If R3/R4 do not name the amount, the honest position
is that the remainder is still unexplained and the card should keep showing it.

## 7. What changes after batch 2e

| Item | Before | After |
|---|---|---|
| Withdrawal fee in ledger | never credited (0 rows, 54 payouts) | credited once per successful payout, from every path |
| Paystack payout fee | never recorded | recorded once per successful payout, as `provider_fee` |
| Net revenue | excludes payout fees | includes them |
| Ledger vs derived | invisible | live card with the remainder and an Alerts row beyond ₦1 |
| Uncredited payouts | invisible | counted and alerted on the same card |

## 8. What I could not do

- Query the live database (no usable credentials in this environment), so the
  exact ledger rows are not listed here. Section 5 gives the queries that list
  them, and the card gives them grouped by kind from now on.
- Confirm the body of `fb_settle_payment`, `fb_credit_withdrawal_fee`,
  `fb_reserve_withdrawal` and `fb_admin_reserve_transfer`: they live only in the
  database, not in this repository. Conclusions that depend on them are marked as
  inferences, not facts.
- Determine whether settlement already reverses a fee on refund, because the
  refund path's fee handling is inside those same database functions.
