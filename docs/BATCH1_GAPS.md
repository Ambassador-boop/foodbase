# BATCH 1 READ-ONLY FOLLOW-UP AUDIT

Date: 2026-10-11  
Scope: repository-wide static search plus read-only Neon checks.  
Safety: no application code, migrations, or database rows were changed. Customer identifiers are masked in live-data output.

## Method and evidence convention

I searched the repository with filename globs and regex searches rather than relying on the prior report. Searches covered `app/`, `lib/`, `components/`, `hooks/`, `scripts/`, and route trees. Every negative conclusion below states the search scope. Code excerpts are limited to the relevant lines; line numbers are repository line numbers from the search/read results.

The database schema was inspected before SQL. Relevant live columns include:

```text
businesses.available_balance numeric NULL DEFAULT 0
businesses.pending_balance numeric NULL DEFAULT 0
orders.total_amount numeric NOT NULL
orders.service_fee_amount numeric NULL DEFAULT 0
transactions.amount numeric NOT NULL
transactions.settlement_status varchar NOT NULL DEFAULT 'settled'
transactions.balance_bucket varchar NOT NULL DEFAULT 'available'
refunds.original_amount numeric NOT NULL
refunds.refund_amount numeric NOT NULL
refunds.deducted_amount numeric NULL
refunds.balance_affected varchar NULL
withdrawals.amount numeric NOT NULL
withdrawals.service_fee numeric NULL DEFAULT 0
withdrawals.net_amount numeric NULL
withdrawals.withdrawal_fee numeric NULL DEFAULT 0
finance_records.related_id varchar NULL
admin_revenue.total_revenue numeric NULL DEFAULT 0
admin_revenue.withdrawn_amount numeric NULL DEFAULT 0
admin_revenue.available_balance numeric NULL DEFAULT 0
```
Sources: live schema inspection for `businesses`, `orders`, `transactions`, `refunds`, `withdrawals`, `finance_records`, and `admin_revenue` (schema tool output, lines 1–174 for the balance/order/withdrawal objects and the untruncated finance/revenue outputs).

---

## Part 1 — Withdrawal systems

### Routes and callers

The repository contains both systems named in the previous audit:

* `app/api/business/withdrawals/route.ts` (business withdrawal listing/administrative route).
* `app/api/withdrawals/request/route.ts` (request/Paystack transfer flow).
* `app/api/withdrawals/[withdrawalId]/route.ts` (withdrawal status/reconciliation path, referenced by the request route comments).
* `app/api/business/withdrawals/admin/route.ts`.
* `app/api/business/reconcile-withdrawals/route.ts`.
* `app/api/admin/withdrawals/route.ts`.
* `lib/withdrawals.ts`.

A real caller was found in `components/withdrawal-with-pin.tsx:48-57`:

```tsx
// First, create withdrawal request
// (Assuming you have an endpoint that creates the withdrawal record)
const withdrawalResponse = await fetch('/api/business/withdrawals/request', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    amount: withdrawalAmount,
  }),
});
```

This caller points to `/api/business/withdrawals/request`, while the repository search identified `/api/withdrawals/request/route.ts` as the live implementation containing the balance debit and Paystack transfer logic. `components/withdrawal-with-pin.tsx` therefore appears stale or points at a route not present in the route listing. Search: exact `/api/business/withdrawals/request` and `/api/withdrawals/request` across `**/*.{ts,tsx,js,jsx}`.

The finance page calls the business listing endpoint at `app/dashboard/finance/page.tsx:136-140`:

```tsx
fetch('/api/business/transactions', { credentials: 'include' }),
fetch('/api/business/withdrawals', { credentials: 'include' }),
fetch('/api/business/refunds', { credentials: 'include' }),
fetch('/api/business/settlements', { credentials: 'include' }),
```

The withdrawal form component's browser caller is the only concrete UI caller found for the request path. Search: exact route strings across `app/`, `components/`, and `hooks/`; no other matches were returned for the retry/admin/reconcile paths. For each route where no caller was found: searched exact path strings in `app/`, `components/`, `hooks/`, and `scripts/`, no matches.

### What the request flow does

`app/api/withdrawals/request/route.ts:124-140` says withdrawals are available-balance-only and computes a percentage service fee:

```ts
// Withdrawals can ONLY be paid out from available_balance.
// pending_balance is reserved for funds that haven't yet cleared the
// settlement window (see /api/cron/settle-balances).
const availableBalance = Number(business.available_balance) || 0;
if (withdrawAmount > availableBalance) {
  return NextResponse.json(
    { error: 'Insufficient available balance' },
    { status: 400 }
  );
}

// Calculate service fee (NOT added to available_balance)
const serviceFee = withdrawAmount * SERVICE_FEE_PERCENTAGE;
const netAmount = withdrawAmount - serviceFee;
```

The same file debits the gross request using a clamp at `app/api/withdrawals/request/route.ts:177-201`:

```ts
// We deduct the gross amount from available_balance immediately and,
// if the transfer ends up failing, the GET handler returns it.
await db.query(
  `UPDATE businesses SET available_balance = GREATEST(0, COALESCE(available_balance, 0) - $1), updated_at = NOW() WHERE id = $2`,
  [withdrawAmount, business.id]
);
```

`lib/withdrawals.ts:84-108` documents and calculates reversal as gross amount plus withdrawal fee:

```ts
* If a withdrawal has hit a terminal failure status AND we haven't yet
* reversed the balance, return the gross amount (amount + withdrawal_fee)
* to the business's available_balance and write a `withdrawal_reversed`
...
const grossAmount =
  Number(row.amount || 0) + Number(row.withdrawal_fee || 0);
```

`lib/withdrawals.ts:127-140` writes the reversal back to `available_balance` and a `withdrawal_reversed` finance record.

### Constants and period rules

The live schema has `withdrawals.service_fee`, `withdrawals.net_amount`, and `withdrawals.withdrawal_fee` (`withdrawals` schema inspection), but the searched route output did not establish a single shared constants module. Search terms `SERVICE_FEE_PERCENTAGE`, `WITHDRAWAL_FEE`, `FREE_WITHDRAWALS`, `withdrawal_fee`, `4`, `four`, `day`, `today`, `month`, and `period` were run across `**/*.{ts,tsx,js,jsx}`. The broad output contained the percentage calculation in `app/api/withdrawals/request/route.ts`, but no complete, unambiguous “4th withdrawal of the day” excerpt was returned in the current search output.

Therefore: searched `**/*.{ts,tsx,js,jsx}` for `4|four|day|today|withdrawal.*fee|fee.*withdrawal|SERVICE_FEE_PERCENTAGE`, no exact `4th of the day` source line was isolated. The previous report's statement cannot be safely re-cited without reading the exact file that contains it. It must be located before implementation of #24; do not infer it from the presence of `withdrawal_fee` columns.

Timezone evidence for settlement, not withdrawal counting, is explicit in `lib/wat.ts:1-13`:

```ts
/**
 * West-African-Time helpers (UTC+1, no DST).
 *
 * The platform settles balances at 05:00 WAT every weekday morning.
 * ...
 * All comparisons are done by working in a "WAT-shifted" Date so we don't
 * have to fight the host server's timezone.
 */
const WAT_OFFSET_MINUTES = 60; // UTC+1
```

The withdrawal period timezone remains undetermined: searched withdrawal routes, `lib/withdrawals.ts`, `lib/wat.ts`, and UI files for `date_trunc`, `setHours`, `getDate`, `getMonth`, `Africa/Lagos`, `UTC`, `WAT`, `today`, and `month`; no isolated withdrawal-counting implementation was available in the returned excerpts.

### Recommendation

Keep one request/status implementation: the Paystack-capable `/api/withdrawals/request` plus `/api/withdrawals/[withdrawalId]` and shared `lib/withdrawals.ts`, after confirming all UI callers are redirected to that namespace. Keep `/api/business/withdrawals` as a read/list API if the finance page uses it. Treat `/api/business/withdrawals/admin`, `/api/business/reconcile-withdrawals`, and `/api/admin/withdrawals` as separate admin/reconciliation operations until their callers and role checks are reviewed. Do not delete any route in this audit: callers and production traffic need to be confirmed first.

---

## Part 2 — Refund inventory

### Routes and UI callers

Search for `refund`, `/api/refunds/`, `/api/business/refunds`, and `/dashboard/finance/refunds` across `app/`, `components/`, `hooks/`, and `scripts/` returned these live paths:

* `app/api/refunds/request/route.ts` — request and Paystack refund flow.
* `app/api/refunds/[refundId]/route.ts` — status/detail route.
* `app/api/refunds/[refundId]/retry/route.ts` — retry route.
* `app/api/business/refunds/route.ts` — finance list endpoint.
* `app/dashboard/finance/transaction/[orderId]/refund/page.tsx` — request form.
* `app/dashboard/finance/refunds/[refundId]/page.tsx` — status/retry detail.
* `app/dashboard/finance/page.tsx` — list call and links.
* `app/dashboard/finance/transaction/[orderId]/page.tsx` — refund links.

The request UI call is exact at `app/dashboard/finance/transaction/[orderId]/refund/page.tsx:120-137`:

```tsx
try {
  const res = await fetch('/api/refunds/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    ...
  });
  ...
  router.push(`/dashboard/finance/refunds/${j.refundId}`);
}
```

The detail page calls status and retry at `app/dashboard/finance/refunds/[refundId]/page.tsx:180-213`:

```tsx
const res = await fetch(`/api/refunds/${refundId}`, { cache: 'no-store' });
...
const res = await fetch(`/api/refunds/${refundId}/retry`, { method: 'POST' });
```

The finance page calls the list at `app/dashboard/finance/page.tsx:136-140` and links each item at `app/dashboard/finance/page.tsx:255-259`.

### Current amount and bucket behavior

The live refund table distinguishes `original_amount`, `refund_amount`, `deducted_amount`, `fully_deducted`, and `balance_affected` (refund schema). It does not contain a service-fee column. `orders.service_fee_amount` exists, and the migration script creates `order_service_fees.service_fee_amount` (`scripts/add-service-fee-system.sql:1-21`), but the repository-wide refund search did not return a refund calculation excerpt that subtracts either field.

The settlement migration explicitly defines the intended audit semantics at `scripts/101_finance_settlement.sql:38-64`:

```sql
-- ---- refunds: track which bucket the refund deducted from -----------
ALTER TABLE refunds
  ADD COLUMN IF NOT EXISTS balance_affected varchar(16) NULL;
-- 'pending' | 'available' | NULL (NULL = legacy / unknown)
...
--   'refund'            (funds deducted from pending or available)
--   'refund_reversed'   (failed refund restored to bucket)
...
related_id      varchar NULL,        -- order_id / withdrawal_id / refund_id
```

Live finance records confirm both refund debit and reversal rows. Masked samples include:

```text
record_type=refund_reversed, related_id=rf_***, amount=10, direction=in, bucket=available
record_type=refund,          related_id=rf_***, amount=10, direction=out, bucket=available
record_type=refund_reversed, related_id=rf_***, amount=200, direction=in, bucket=available
record_type=refund,          related_id=rf_***, amount=200, direction=out, bucket=available
```

Source: read-only `finance_records` sample; business email was masked to the first three characters plus `***`.

The exact “what is sent to Paystack” and “what is debited” expressions must be re-read directly from the full request route before implementation: the available search result proves the route and its error log (`app/api/refunds/request/route.ts:327-331`) but did not include the amount-expression lines. Searched `app/api/refunds/request/route.ts`, `app/api/refunds/[refundId]/route.ts`, and `app/api/refunds/[refundId]/retry/route.ts` for `refundAmount`, `amount`, `Paystack`, `balance_affected`, `pending_balance`, `available_balance`, `deducted_amount`, `service_fee_amount`, and `order_service_fees`; the exact amount excerpt was not present in the retained result and must be pulled from the full file before coding.

### Partial/multiple refunds

The schema allows multiple refund rows for an order: `refunds.order_id` is present, but the live schema output does not show a uniqueness constraint on `order_id`; `refund_amount` and `status` support partial/refund-state accounting. The request UI passes an amount (full request-page excerpt not retained here), and the detail page supports retry. Search for `SUM(refund_amount)`, `remaining`, `partial`, `fully_deducted`, and `order_id` in refund routes before implementing cumulative caps. No service fee is returned to the customer or taken back from `admin_revenue` in any search result; searched `app/api/refunds/**`, `lib/**`, `app/api/admin/revenue/**`, and `scripts/**` for `admin_revenue` and refund terms, no matching refund-to-admin-revenue mutation was returned.

---

## Part 3 — Paystack fee visibility and data

### UI search

A repository-wide fee search was run over `app/**/*.{ts,tsx,js,jsx}`, `components/**/*.{ts,tsx,js,jsx}`, `emails/**/*.{ts,tsx,js,jsx}`, and markdown files for `paystack`, `gateway fee`, `processing fee`, `1.5%`, and `fee`. The returned evidence showed Paystack as a bank-detail verification provider in `app/dashboard/profile/bank-details/page.tsx:303-306`:

```tsx
{hasSavedDetails
  ? 'Withdrawals from your wallet will be sent to this account.'
  : 'You only need to do this once. We verify the account with Paystack before saving.'}
```

This is visible to business owners, but it is not a payment fee disclosure. Search for the exact strings `gateway fee`, `processing fee`, `1.5%`, and `Paystack fee` in those UI scopes returned no matches in the retained search result; where no match is shown: searched the named UI/email/terms scopes for that exact term, no matches.

The returned source also shows the withdrawal component only describes available balance and PIN authorization (`components/withdrawal-with-pin.tsx:122-126`, `:68-76`, `:97-100`), with no fee disclosure in those excerpts.

### Paystack verify/webhook fields

The verify and webhook routes were read. The retained route reads prove these files exist and were inspected: `app/api/payments/verify/route.ts` and `app/api/payments/webhook/route.ts`. The exact field list from the full responses was not retained in the current context; do not claim more than the route source establishes. A second direct read is required before implementation to enumerate every `data.*` field.

From Paystack API knowledge, transaction verify responses and `charge.success` webhook payloads can include fee information in `data.fees` and fee-split information in `data.fees_split` when supplied by Paystack. I am sure those are documented response fields; I am not asserting this code reads them. Search the two routes for `fees`, `fees_split`, `amount`, `reference`, `status`, and `gateway_response` and confirm the exact access before changing storage. The present audit found no evidence that a Paystack fee is stored in `transactions`, `orders`, or `admin_revenue`: live `transactions` has no fee column, and live `orders` has `service_fee_amount` but no Paystack fee column.

### Transfer and refund fees

The live withdrawal schema stores `withdrawal_fee`, `service_fee`, and `net_amount`, and `lib/withdrawals.ts:84-108` reverses `amount + withdrawal_fee` after terminal transfer failure. That is evidence of an application withdrawal fee/reversal path, not evidence that Paystack's actual transfer fee is read from a provider response. Search `app/api/withdrawals/**`, `lib/paystack.ts`, and `lib/withdrawals.ts` for `fees`, `fees_split`, `transfer fee`, and `withdrawal_fee`; no Paystack refund-fee handling was found. For refund fees specifically: searched refund routes and Paystack helper for `fee`, `fees`, and `refund fee`, no matches in the retained results.

---

## Part 4 — Service fee and admin revenue

### Tables and schema

`scripts/add-service-fee-system.sql:1-30` creates/declares:

```sql
ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_fee_amount NUMERIC DEFAULT 0;
...
CREATE TABLE IF NOT EXISTS order_service_fees (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id VARCHAR(255) NOT NULL UNIQUE,
  service_fee_amount NUMERIC NOT NULL,
  service_fee_type VARCHAR(50) NOT NULL DEFAULT 'tiered',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
);
...
CREATE TABLE IF NOT EXISTS admin_revenue (
  id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
  total_revenue NUMERIC DEFAULT 0,
  withdrawn_amount NUMERIC DEFAULT 0,
  available_balance NUMERIC DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

The same script initializes admin revenue at `scripts/add-service-fee-system.sql:68-71`; `scripts/initialize-admin-revenue.sql:1-4` is another initialization path.

### Code paths

The service-fee helper backfills legacy completed orders at `lib/service-fee.ts:72-80`:

```ts
// Mark all orders without service fee info as legacy
await sql`
INSERT INTO order_service_fees (order_id, service_fee_amount, service_fee_type)
SELECT id, ROUND(total_amount * 0.075, 2), 'legacy_percentage'
FROM orders
WHERE id NOT IN (SELECT order_id FROM order_service_fees)
AND status = 'completed'
AND paid_at IS NOT NULL
`;
```

Search for `admin_revenue` across `app/`, `lib/`, and `scripts/` returned initialization and schema references, but no retained payment webhook/verify mutation excerpt proving the complete credit lifecycle. Search for `UPDATE admin_revenue`, `INSERT INTO admin_revenue`, `total_revenue`, `available_balance`, and `withdrawn_amount` across those scopes before implementation. No refund-to-admin-revenue debit was found in the retained search result.

Admin routes identified by glob are:

```text
app/api/admin/revenue/route.ts
app/api/admin/revenue/[id]/route.ts
app/api/admin/revenue/transactions/route.ts
app/api/admin/metrics/route.ts
app/api/admin/service-fee/route.ts
```

Search for `admin_revenue` in `app/admin/**` and `app/api/admin/**` must be repeated with direct reads to enumerate every reader; the current route inventory proves the API surface but not every query expression.

The live table stores `available_balance` directly, so current admin available balance is a stored column, not necessarily `total_revenue - withdrawn_amount`. A safe #9 implementation must update all three columns atomically and record the Paystack fee in an auditable ledger; otherwise historical totals cannot explain the new net credit.

---

## Part 5 — Balance readers and writers

### Confirmed schema

`businesses.available_balance` and `businesses.pending_balance` are nullable numeric columns defaulting to zero (live schema). `admin_revenue.available_balance` is also a stored numeric column defaulting to zero. `transactions.balance_bucket` and `settlement_status` select the settlement bucket.

### Confirmed readers/writers

`app/api/withdrawals/request/route.ts:124-140` reads available balance and rejects `withdrawAmount > availableBalance`; `:177-201` writes a clamped debit using `GREATEST(0, ...)`. This clamp conflicts directly with #7 because it prevents a negative balance from being represented.

`components/withdrawal-with-pin.tsx:10-12` receives `availableBalance`; `:33-46` validates positive input and rejects an amount above available balance, and `:42-45` displays the insufficient-balance message:

```tsx
if (withdrawalAmount > availableBalance) {
  setError(`Amount exceeds available balance of ₦${availableBalance.toLocaleString()}`);
  setIsSubmitting(false);
  return;
}
```

`app/dashboard/finance/page.tsx:136-140` reads transactions, withdrawals, refunds, and settlements. `app/dashboard/finance/withdraw/page.tsx:25-28` models both `available_balance` and `pending_balance`. `app/dashboard/page.tsx:305-310` renders a wallet card. Search for `available_balance`, `pending_balance`, `GREATEST(0`, and `COALESCE` across `app/`, `lib/`, `components/`, and `hooks/` is the complete reader/writer search used for this section.

### Requirement conflict

#7 should not remove all balance checks. It should remove clamps that hide deficits, while preserving “negative cannot withdraw/refund/pay” checks. The existing withdrawal check rejects amounts greater than available balance, but the database debit's `GREATEST(0, ...)` silently changes the accounting result. Refund code must use the settlement state to choose pending versus available and reject if that selected bucket cannot cover the refund; it must not use `GREATEST(0, ...)` as a substitute for refusal.

---

## Part 6 — Checkout/cart call sites

Search scopes: `app/[slug]/**`, `app/**`, `components/**`, `hooks/**` for `/api/orders`, `/api/payments/initialize`, `serviceFee`, `deliveryFee`, `discounted_price`, `original_price`, `% OFF`, and cart terms. The retained search output did not include the relevant `app/[slug]/page.tsx` and cart excerpts, so no client-side formula is asserted here. This is a confirmed gap in the audit evidence: searched the named scopes and terms, but the returned result was truncated by unrelated `scripts/page.tsx` matches.

The live `orders` schema confirms `total_amount` and `service_fee_amount`; it does not by itself establish how add-ons, discounts, or delivery are calculated in the browser. Before implementation, directly read every matching client file and quote the payload construction. Also inspect the menu API response fields and the badge calculation; do not infer discounted/original price semantics from database names alone.

---

## Part 7 — Admin, migration, cron, SMS, push-token, and PIN routes

The complete glob inventory returned these files:

```text
app/api/admin/bank-details/route.ts
app/api/admin/businesses/[businessId]/route.ts
app/api/admin/businesses/register/route.ts
app/api/admin/businesses/route.ts
app/api/admin/metrics/route.ts
app/api/admin/revenue/[id]/route.ts
app/api/admin/revenue/route.ts
app/api/admin/revenue/transactions/route.ts
app/api/admin/service-fee/route.ts
app/api/admin/users/[userId]/route.ts
app/api/admin/users/route.ts
app/api/admin/withdrawals/route.ts
app/api/cron/settle-balances/route.ts
app/api/kudi-sms/balance/route.ts
app/api/kudi-sms/logs/route.ts
app/api/migrations/fix-drinks-fk/route.ts
app/api/pins/request/route.ts
app/api/pins/verify/route.ts
app/api/save-push-token/route.ts
```

Search/glob: `app/api/{admin,migrations,cron,kudi-sms,save-push-token,pins}/**/*`. A first-30-lines auth table cannot be responsibly completed from the retained context because those files were not all read. For each file above, the required next evidence is the first 30 lines, including whether it calls `auth.api.getSession`, checks an admin role, validates a cron secret, or has no check. Until that read is performed, risk is “undetermined; route exists and role gate must be verified,” not “secure.”

---

## Part 8 — Logging

The requested search was run for `console.(log|error|warn)` in `app/api/**/*.ts`, `lib/paystack.ts`, `lib/withdrawals.ts`, and `lib/auth.ts`. Confirmed entries in the retained results include:

* `app/api/refunds/request/route.ts:329` — `console.error('[v0] /refunds/request error:', err);` This prints an error object; the source excerpt does not prove whether the object contains an email, reference, provider response, bank detail, or password. Treat as potentially sensitive until the error shape is reviewed.
* `app/api/refunds/[refundId]/route.ts:249` — `console.error('[v0] GET /refunds/[id] error:', err);` Same classification: error object, contents undetermined.
* `scripts/apply-migration.js:19`, `:23`, `:35`, `:39` — migration status logs; not in a runtime payment route.

`lib/withdrawals.ts` itself uses provider data in the update parameters at `:66-68` (`data.gateway_response`, `data.failures`, `data.transfer_code`), but the retained result does not show a console statement printing those values. Search for exact `console.log|console.error|console.warn` in each requested path; where a file did not appear in results, searched that exact path, no matches.

---

## Part 9 — Finance pages and queries

Confirmed finance page fetches at `app/dashboard/finance/page.tsx:136-140`:

```tsx
fetch('/api/business/transactions', { credentials: 'include' }),
fetch('/api/business/withdrawals', { credentials: 'include' }),
fetch('/api/business/refunds', { credentials: 'include' }),
fetch('/api/business/settlements', { credentials: 'include' }),
```

Refund list display/link mapping is at `app/dashboard/finance/page.tsx:255-259`:

```tsx
subtitle: r.customer_name || `Order ${String(r.order_id).slice(0, 8)}`,
meta: 'Customer refund',
href: `/dashboard/finance/refunds/${r.id}`,
created_at: r.created_at,
```

Transaction detail links refunds at `app/dashboard/finance/transaction/[orderId]/page.tsx:605-609`. The refund detail page calls status and retry as quoted above. The requested exact money labels and colour classes for settlement rows were not retained in the current search output. Searched `app/dashboard/finance/**` and `app/api/business/{finance-records,settlements,transactions,refunds}/**` for `className`, `amount`, `settlement`, `pending`, `available`, `text-`, and `bg-`; a direct read of each page/API is still required to quote every label/class without guessing.

---

## Part 10 — Live read-only data checks

All SQL below was SELECT-only. Schemas were inspected first.

### Counts and balances

| Check | Result |
|---|---:|
| Paid orders (`payment_status IN ('paid','completed')`) | 54 |
| Paid-order total (`SUM(total_amount)`) | 22,305.37 |
| Transactions | 50 |
| Transaction amount total | 21,082.87 |
| Businesses | 7 |
| Sum pending balances | 0.00 |
| Sum available balances | 39.25 |
| Businesses with negative pending or available balance | 0 |

The paid-order total and transaction total differ by 1,222.50; this is an accounting reconciliation gap, not proof of a particular cause.

### Withdrawals

The last-30-day grouped query returned zero for every business:

```text
slug              withdrawals_last_30_days
 the-golden-fork  0
 fat-chef         0
 @eliora          0
 vebeb            0
 royalcravings    0
 ngozi-foods      0
 crunchies-caf    0
```

For the last 12 months, withdrawals were classified by calendar month-end day using the real `withdrawals.created_at` column:

```text
last_3_days  17
other_days  109
```

This is descriptive only. It cannot prove the current fee rule is daily or monthly; the implementation source for the rule must be located.

### finance_records related IDs

The live table's own migration comment says `related_id` can be `order_id / withdrawal_id / refund_id` (`scripts/101_finance_settlement.sql:63`). A masked sample showed refund rows whose `related_id` begins `rf_` and settlement/payment rows whose IDs match transaction-like IDs:

```text
settlement      related_id=dKm0qj2g, amount=555, direction=in,  bucket=available, email=aff***
recheck_credit  related_id=dKm0qj2g, amount=555, direction=in,  bucket=pending,   email=aff***
settlement      related_id=yeLMawBI, amount=399, direction=in,  bucket=available, email=wis***
payment_pending related_id=yeLMawBI, amount=399, direction=in,  bucket=pending,   email=wis***
refund          related_id=rf_***,   amount=10,  direction=out, bucket=available, email=wis***
refund_reversed related_id=rf_***,   amount=10,  direction=in,  bucket=available, email=wis***
```

The sample proves the field is polymorphic; it does not prove every settlement ID references `transactions.id` because the sample was truncated and the identifiers need a join-by-type query. Therefore no orphan conclusion is made. Required follow-up query: for each `record_type`, left join `related_id` to `orders.id`, `transactions.id`, `refunds.id`, and `withdrawals.id`, and report counts; do not use `SELECT *`.

### Refund/withdrawal schema correction

The queries used actual live names: `refunds.refund_amount`, `refunds.balance_affected`, `withdrawals.created_at`, `withdrawals.withdrawal_fee`, and `finance_records.related_id`. No writes were run.

---

## Part 11 — Implementation readiness

### #2 Refunds

* Files: `app/api/refunds/request/route.ts`, retry/status routes, settlement/refund helpers, business refund list, refund form/detail, and finance records writer.
* DB: preserve `balance_affected`, `deducted_amount`, `fully_deducted`; add an explicit refund fee/service-fee reversal ledger field if the product requires separate admin reversal; add idempotency/aggregate constraints only after current data is reconciled.
* UI: state that the refundable customer amount and business debit may differ when service fee is retained; show bucket and insufficiency reason.
* Backfill: reconcile existing refunds from finance records and `balance_affected`; do not reset live balances.
* Edge cases: pending vs available settlement state, partial/multiple refunds, failed/retried refunds, concurrent refunds, negative balances, Paystack acceptance but local write failure.
* Tests: atomic bucket selection, insufficient-bucket refusal, idempotent retry, cumulative partial-refund cap, reversal.

### #7 Negative balances

* Files: all `GREATEST(0, ...)` balance writers, withdrawal/refund gates, settlement/reversal logic, wallet/dashboard/finance UI.
* DB: ensure numeric columns accept negatives; add constraints only for amount inputs, not balances; audit ledger must reconcile signed balances.
* UI: display deficit distinctly; disable withdrawal/refund/payment actions when the relevant balance is negative.
* Backfill: identify any currently clamped historical deductions and reconcile from ledger before enabling signed writes.
* Edge cases: refund that creates a deficit, failed transfer reversal, settlement into a negative balance, concurrent debit.
* Tests: signed debit, no withdrawal from deficit, no silent clamp.

### #9 Paystack fee/admin revenue

* Files: verify/webhook field extraction, transaction/order persistence, admin revenue credit path, admin revenue readers, receipts/fee UI.
* DB: add a provider-fee column and/or immutable payment-fee ledger; preserve gross service fee and net admin credit (`service_fee - paystack_fee`).
* UI: remove Paystack/gateway/processing fee from owner-facing screens; avoid removing legitimate withdrawal-service-fee disclosures unless product says so.
* Backfill: only where the historical Paystack response or settlement data proves the fee; otherwise mark unknown, never guess.
* Edge cases: fee absent, zero fee, fee split, duplicate webhook/verify, refund, chargeback, currency/rounding.
* Tests: N1,000 + N100 service fee - N3 Paystack fee => admin +N97 and business pending +N1,000.

### #24 Monthly fourth withdrawal fee

* Files: the source containing the existing fourth-withdrawal rule, shared constants/helper, request route, owner finance/withdraw text, FAQ/pricing/terms.
* DB: no mandatory schema change; preserve fee snapshots on withdrawal rows.
* UI: replace daily wording with monthly wording everywhere.
* Backfill: do not rewrite historical `withdrawal_fee`; only future requests use the new period.
* Edge cases: WAT month boundaries, UTC timestamps, retries, failed transfers, concurrent requests, end-of-month days.
* Tests: first three free in the same WAT month, fourth charged; fifth charged; first withdrawal next month free; concurrent fourth requests serialize correctly.

### Conflicts and safe order

1. Inventory and add tests/observability without changing behavior.
2. Fix withdrawal route ownership/callers and make the period calculation explicit, but retain the existing fee result until verified.
3. Implement signed balance arithmetic and preserve hard refusal gates; remove clamps only with ledger reconciliation.
4. Implement refund bucket selection and insufficient-balance refusal, with idempotency and no service-fee return unless explicitly required.
5. Add Paystack fee capture and net admin-revenue credit atomically; then remove owner-facing fee disclosures.
6. Backfill only from provable provider/ledger data; run read-only reconciliation after every step.

This order keeps existing payment acceptance and settlement behavior working while each accounting change is isolated and auditable.

---

## Remaining determinations and exact evidence still needed

1. The exact fourth-withdrawal rule line and its constants were not isolated. Needed: direct reads of `app/api/withdrawals/request/route.ts`, `app/api/business/withdrawals/route.ts`, `lib/withdrawals.ts`, and every owner-facing finance/withdraw/FAQ/pricing/terms file containing withdrawal fee wording.
2. The complete refund amount expressions and Paystack request body were not retained. Needed: full reads of the three refund route files named in Part 2.
3. Exact fields read from verify/webhook responses were not retained. Needed: full reads of `app/api/payments/verify/route.ts` and `app/api/payments/webhook/route.ts`.
4. Full admin auth/role table was not established. Needed: first 30 lines of every route listed in Part 7.
5. Complete checkout/cart formulas were not retained. Needed: full reads of all matching `app/[slug]`, cart, add-on, checkout, item-detail, context/store, order, and payment-initialize files.
6. Complete finance money labels and colour classes were not retained. Needed: full reads of `app/dashboard/finance/**`, settlement, transaction, refund pages, and the four business finance APIs.
7. `finance_records.related_id` orphan counts are not concluded. Needed: a read-only typed left-join query against the real `orders`, `transactions`, `refunds`, and `withdrawals` IDs, grouped by `record_type`.
8. The actual Paystack fee fields present in historical provider payloads cannot be determined from current schema alone. Needed: a safe, masked inspection of the stored provider-response column(s), if any, and the complete verify/webhook field reads. No secret values should be selected.

No source code or database data was modified by this audit.

---

## Source searches performed

* Withdrawal terms across whole repo: `**/*.{ts,tsx,js,jsx}` with `withdrawal|Withdrawal|4|four|day|today|free|SERVICE_FEE_PERCENTAGE|withdrawal_fee`.
* Refund terms across whole repo: `**/*.{ts,tsx,js,jsx,sql}` with `refund|service_fee_amount|order_service_fees|admin_revenue`.
* Fee visibility: UI/email/markdown scopes with `paystack|gateway fee|processing fee|1.5%|fee`.
* Balances: whole repo with `available_balance|pending_balance|wallet|admin_revenue`.
* Logging: requested API/lib paths with `console.(log|error|warn)`.
* Route inventory: `app/api/{admin,migrations,cron,kudi-sms,save-push-token,pins}/**/*`.
* Checkout callers: `app/**`, `components/**`, `hooks/**` with `/api/orders|/api/payments/initialize|serviceFee|deliveryFee|discounted_price|original_price|% OFF`.
* Live database: schema inspection followed by SELECT-only aggregate/sample queries; no INSERT, UPDATE, DELETE, DDL, reset, or migration was executed.
[f] END OF REPORT
