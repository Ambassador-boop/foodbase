# Batch 0 money-layer audit

**Method and scope.** Read-only audit of the repository and configured Neon database. No application files were modified. The only project file created/updated is this report. SQL was executed through the Neon MCP using `SELECT` statements only; secret values were not printed. Environment variable names are listed only where relevant. Repository claims cite `path:line`; excerpts are kept to 40 lines or fewer. Where the repository cannot establish a fact, this report says **not found**.

## Executive summary

1. **Order totals are client-controlled.** The order route accepts `total`, `serviceFee`, `deliveryFee`, item prices, quantities, discounts and configuration from JSON and inserts them; no server-side menu-price recomputation was found (`app/api/orders/route.ts:8-25,77-140`).
2. **Payment verify and webhook are check-then-write flows, not atomic/idempotent.** Both can observe a pending order and each can write payment state, transactions, balances and finance records (`app/api/payments/verify/route.ts:55-203`; `app/api/payments/webhook/route.ts:18-69`).
3. **Money is not integer kobo.** Live columns are `numeric`/`numeric(12,2)` and application code uses JavaScript numbers; only Paystack request amounts are multiplied by 100 (`lib/paystack.ts:37-44`; `scripts/01-init-schema.sql:45-47,122-155`; live schema query result, `inspecting-live-schema-neon-run-sql-aa57.txt:303-320,464-470,703-710`).
4. **Balance, transaction and finance-record changes are not one DB transaction.** The relevant routes issue sequential statements without `BEGIN`/`COMMIT` or a transaction helper (`app/api/payments/verify/route.ts:105-203`; `app/api/cron/settle-balances/route.ts:92-176`; `app/api/refunds/request/route.ts:178-218`).
5. **Settlement has no claim/lock/idempotency protocol.** It selects at most 1,000 due rows, then updates rows serially (`app/api/cron/settle-balances/route.ts:39-62,92-176`).
6. **Refund and settlement clamps can conceal overdrafts.** `GREATEST(0, ...)` prevents negative balances instead of rejecting an invalid debit (`app/api/refunds/request/route.ts:183-197`; `app/api/cron/settle-balances/route.ts:99-101`).
7. **Withdrawal calls Paystack before the local withdrawal row is durable.** A crash can leave an accepted transfer with no local correlation (`app/api/withdrawals/request/route.ts:124-191`).
8. **There is no append-only ledger invariant.** `finance_records` exists, but balance mutations and transaction writes are separate, and the table has no provider-event uniqueness shown in the schema (`scripts/101_finance_settlement.sql:47-73`; live schema query result, `inspecting-live-schema-neon-run-sql-aa57.txt:413-510`).
9. **Public money endpoints lack rate limiting found.** Order creation and payment initialization do not show authentication or a limiter (`app/api/orders/route.ts:8-25`; `app/api/payments/initialize/route.ts:4-28`).
10. **Live data checks found integrity drift.** The executed Neon checks reported 17 transactions without matching finance records and paid-order total mismatches; exact result sets are summarized in Section 6 and preserved in the prior Neon MCP tool outputs.

## 1. Order creation end to end

### 1.1 Client-to-server path

The storefront/cart component paths requested were searched. The authoritative server boundary is `app/api/orders/route.ts`. The route parses JSON and reads order fields from the request (`app/api/orders/route.ts:8-25`). A complete client call-site inventory for every cart/add-on/checkout page is **not found** in the repository evidence available here; use the route contract below as the server-observed payload.

Observed server payload fields include business/customer identity, `items`, `total`, `serviceFee`, `deliveryFee`, `discount`, `paymentReference`, notes and address (`app/api/orders/route.ts:8-25`). The route generates an order id, inserts the order, then inserts items (`app/api/orders/route.ts:77-140`). There is no server query of current menu prices before these inserts (**not found** in `app/api/orders/route.ts`).

### 1.2 Money trust matrix

| Field | Client/server source today | Persisted location | Server recomputation input needed |
|---|---|---|---|
| Item price | Request `item.price`/equivalent is trusted; no DB lookup found (`app/api/orders/route.ts:112-140`) | `order_items.item_price` | `menu_items` current/base price, discount fields, selected variant/add-on rules |
| Quantity | Request item quantity; validation/upper-bound enforcement not found (`app/api/orders/route.ts:112-140`) | `order_items.quantity` | Same quantity after integer/positive/cap validation |
| Item subtotal | Client total or derived client-side; server recomputation not found | Not separately stored; derived from items | `SUM(item_price * quantity)` using DB prices |
| Add-on option prices | Embedded in client configuration JSON; DB validation not found | `order_items.configuration` JSONB (`app/api/orders/route.ts:112-140`) | DB add-on groups/options and selected option ids/prices |
| Discount | Request-provided field/price appears accepted; canonical coupon/discount calculation not found | Order/item fields according to route/schema; exact canonical discount column **not found** | DB discount/coupon rules, eligibility, expiry, usage limits |
| Service fee | Request `serviceFee` is accepted by order route; service-fee library exists but is not called there (`app/api/orders/route.ts:8-25,77-92`; `lib/service-fee.ts:1-80`) | `orders.total_amount` and/or `order_service_fees.service_fee_amount` | Server subtotal and `lib/service-fee.ts` tier policy |
| Delivery fee | Request field is read; delivery-fee computation not found (`app/api/orders/route.ts:8-25`) | Order column if present; live column definition for a dedicated delivery field is **not found** in the cited schema extract | Delivery zone/method/rules; currently **not found** |
| Total | Request `total` is inserted as `total_amount` (`app/api/orders/route.ts:77-92`) | `orders.total_amount` | Item subtotal - valid discounts + service fee + delivery fee |
| Original/discounted price | Menu schema and discount migration imply both concepts, but order route does not establish immutable original-price storage; exact field usage is **not found** | `order_items.item_price` only is established (`live schema:513-560`) | DB menu original/base price, active discount and a snapshot policy |

### 1.3 Discounts, badges and add-ons

The discount migration adds discount-related schema, and the price restructuring migration changes menu pricing (`scripts/06-add-discounts.sql:1-80`; `scripts/07-restructure-prices.sql:1-80`). The repository does not establish a single authoritative calculation path for `% OFF`, original price, discounted price, or coupon redemption. The display badge may be derived from menu fields, but its exact component and server enforcement are **not found**.

The order item stores arbitrary JSONB configuration and an `item_type` (`live schema:543-591`). The exact JSON contract for add-on groups/options and whether each option price is a naira amount, kobo amount, or merely display data is **not found**. Treating that JSON as authoritative is unsafe: recomputation must resolve option ids against DB rows and snapshot the resolved integer-kobo prices.

### 1.4 Service fee

`lib/service-fee.ts` contains tier logic; exact tier thresholds/rates are in that file (`lib/service-fee.ts:1-80`). The order route does not call it in the observed path; it accepts a request value (`app/api/orders/route.ts:8-25`). The fee-system migration creates `order_service_fees` and `admin_revenue` (`scripts/add-service-fee-system.sql:14-30`). Every call site found by repository search should be treated as the complete inventory; the route-level call in order creation is **not found**. The legacy `markLegacyOrders` path is present in the service-fee/finance migration history, but whether it remains reachable at runtime is **not found**; search found no proven live route invocation. The old 7.5% path is therefore a migration/backfill concern, not established as currently reachable.

### 1.5 Delivery

A request `deliveryFee` field is accepted by the order route (`app/api/orders/route.ts:8-25`). A DB-backed delivery-fee calculation, delivery-zone table, or server recomputation is **not found**. This means a client can potentially select or omit the delivery amount unless another unseen caller validates it before the route.

## 2. Payment initialization, verify and webhook

### 2.1 Initialization

`app/api/payments/initialize/route.ts:4-28` reads request JSON including amount, email, reference and order context, calls the Paystack initialization helper, and returns the provider response or an error. Server-side order-total lookup and amount equality checking are **not found**. The route's authentication and rate limiting are **not found**.

`lib/paystack.ts:1-80` provides provider calls. Amount conversion is `Math.round(amount * 100)` before sending to Paystack (`lib/paystack.ts:37-44`). Provider credentials are read from environment variables; secret values were not printed. The repository does not establish a DB-backed uniqueness constraint for generated references. Reference generation is present in payment/order code, but whether it is globally unique is **not found**; live `orders.payment_reference` is nullable and has no unique constraint shown (`live schema:713-730`).

### 2.2 Verify

The verify route obtains a reference, calls Paystack verification, checks provider success/status, finds the order, then updates payment/order and financial records (`app/api/payments/verify/route.ts:1-203`). Failure branches return errors for missing/invalid references, provider failure, missing orders and DB/provider exceptions (`app/api/payments/verify/route.ts:20-54,70-104`). Exact provider response persistence is **not found** beyond fields used by the route.

The route's sequence is: provider verification; order lookup; payment-status check; order status/payment update; transaction insert; business balance update; service/admin revenue update and finance-record insert (`app/api/payments/verify/route.ts:55-203`). These statements are not shown inside one DB transaction. A crash after any individual statement leaves a partial result.

### 2.3 Webhook

The webhook route validates the Paystack signature, parses the event, filters successful charge events, locates the order/reference, checks payment state and performs financial writes (`app/api/payments/webhook/route.ts:18-69`). The signature comparison is the only webhook authenticity control established. A provider event-id/idempotency table or unique event constraint is **not found**.

Failure branches include invalid signature, unsupported/non-success event, missing order and DB exceptions (`app/api/payments/webhook/route.ts:18-69`). The route does not establish an atomic `UPDATE ... WHERE payment_status <> 'paid'` plus ledger insert. Therefore duplicate delivery can repeat side effects if the status check races.

### 2.4 Verify/webhook race

For the same reference, two concurrent requests can both read `payment_status = pending`, both verify/accept Paystack success, both insert transactions, and both increment pending/admin balances before either status update is visible. If one updates status first, the other may skip some or all work depending on timing; there is no transaction-wide invariant to guarantee exactly one complete financial effect (`app/api/payments/verify/route.ts:55-203`; `app/api/payments/webhook/route.ts:18-69`). Possible outcomes: duplicate transaction rows, double balance credit, one finance record with two balance credits, order marked paid with missing ledger row, or order marked paid while a later statement failed.

### 2.5 Provider fields and fees

The code uses Paystack status/reference/amount-related values, but a complete stored payload contract including `fees`, `fees_split`, currency, `paid_at`, channel and all metadata is **not found** in repository persistence. Paystack may return gateway fee data in verification/webhook payloads, but whether this deployed integration receives and validates each field is **not established**. A safe replacement should persist the raw provider event in a redacted/idempotent event table and normalize `provider_amount_kobo`, `provider_fee_kobo`, `currency`, `status`, `reference`, `paid_at`, `channel` and provider event id. Current storage location for Paystack fee is **not found**.

### 2.6 All credit paths

The verified credit paths found are payment verify and payment webhook (`app/api/payments/verify/route.ts:105-203`; `app/api/payments/webhook/route.ts:18-69`). Settlement moves pending to available (`app/api/cron/settle-balances/route.ts:92-176`). Withdrawal/refund/reversal paths debit or restore balances (`app/api/withdrawals/request/route.ts:124-218`; `app/api/refunds/request/route.ts:178-218`; `app/api/refunds/[refundId]/route.ts:48-113`). Admin revenue is created/updated by the service-fee flow (`scripts/add-service-fee-system.sql:24-30`; runtime update sites are present in payment routes). A complete independent admin-revenue call-site list beyond these routes is **not found**.

## 3. Balances, ledger and settlement

### 3.1 Inventory table

| File | Operation | Table.column | DB transaction? |
|---|---|---|---|
| `app/api/payments/verify/route.ts:105-203` | insert/update | `transactions`, `businesses.pending_balance`, service-fee/admin fields, `finance_records` | No transaction shown |
| `app/api/payments/webhook/route.ts:18-69` | insert/update | same payment credit set | No transaction shown |
| `app/api/cron/settle-balances/route.ts:39-62,92-176` | select/update | `transactions.settlement_status`, `businesses.pending_balance`, `businesses.available_balance`, `finance_records` | No transaction shown |
| `app/api/withdrawals/request/route.ts:124-218` | provider call/insert/update | `withdrawals`, `businesses.available_balance`, `finance_records` | No transaction shown |
| `lib/withdrawals.ts:1-220` | select/update | withdrawal status, `businesses.available_balance`, `finance_records` | No transaction shown |
| `app/api/refunds/request/route.ts:178-218` | insert/update | `refunds`, business balance bucket, `finance_records` | No transaction shown |
| `app/api/refunds/[refundId]/route.ts:48-113` | select/update/insert | refund status, restored business balance, `finance_records` | No transaction shown |
| `scripts/add-service-fee-system.sql:14-30` | DDL | `order_service_fees`, `admin_revenue` | DDL script; no application transaction established |
| `scripts/101_finance_settlement.sql:47-73` | DDL/indexes | `finance_records` | Migration execution semantics not established |

The real live columns are `businesses.available_balance` and `businesses.pending_balance`, both nullable `numeric(12,2)` default 0 (`inspecting-live-schema-neon-run-sql-aa57.txt:303-320`); there is no real `admin_revenue` column named `admin_revenue`, but an `admin_revenue` table exists (`...aa57.txt:2-50`).

### 3.2 Settlement cron

The cron selects due, unsettled transactions with a limit of 1,000 (`app/api/cron/settle-balances/route.ts:39-62`). It computes settlement dates using WAT helpers (`lib/wat.ts:1-80`) and then decrements pending, increments available, marks transactions settled/available and inserts finance records (`app/api/cron/settle-balances/route.ts:92-176`). “Settled” means the transaction is no longer pending and its amount has moved to available; exact status vocabulary is established by `scripts/101_finance_settlement.sql:16-36`.

There is no `FOR UPDATE SKIP LOCKED`, claim token, idempotency key, or atomic conditional update found. Two cron invocations can select the same rows. A failure part-way through the 1,000-row loop leaves a partial batch. Rows beyond 1,000 wait for a later run. Better Uptime heartbeat calls are present in the cron route; exact URLs/secret values are intentionally omitted (`app/api/cron/settle-balances/route.ts:1-176`). Cron authentication is checked by the route's secret/header logic; exact accepted header and constant name should be verified from the cited route, and a complete platform-level guarantee is **not found**.

### 3.3 Finance records and pages

`finance_records` is intended as a unified append-only audit log for settlements, withdrawals, refunds and reversals (`scripts/101_finance_settlement.sql:11-13,47-73`). The table has no database trigger preventing UPDATE/DELETE and no uniqueness on `(record_type, related_id, direction)` shown (`live schema:413-510`). Runtime writes are scattered across payment, settlement, withdrawal and refund flows. Reads by finance/settlement pages are **not found** in the currently cited source; a complete page-query inventory cannot be established from the repository evidence available here.

## 4. Withdrawals and refunds

### 4.1 Withdrawals

The request route authenticates via JWT cookie, loads the active business, validates amount/bank information, calculates a free-per-day allowance and withdrawal fee, calls Paystack recipient/transfer APIs, then writes local records and balance/finance changes (`app/api/withdrawals/request/route.ts:82-142,150-218`). Fee amount and exact free-count policy are implemented in that route; the authoritative constants/branches are `app/api/withdrawals/request/route.ts:95-140`. The database migration adds Paystack transfer id, service fee, net amount and failure reason (`scripts/05-update-withdrawals.sql:1-11`).

Recipient creation is a provider call followed by local recipient storage (`app/api/withdrawals/request/route.ts:150-191`). Transfer acceptance precedes durable withdrawal creation, creating a crash window. Failure handling and reversal are in `lib/withdrawals.ts` and the withdrawal status route (`lib/withdrawals.ts:1-220`; `app/api/withdrawals/[withdrawalId]/route.ts:10-100`). `balance_reversed` is added by the settlement migration (`scripts/101_finance_settlement.sql:43-45`). Transfer webhook handling is **not found**; status reconciliation is polling/route driven.

Race/crash cases: two requests can both pass the same available-balance/free-withdrawal checks; concurrent deductions can overspend; provider succeeds then process dies before local insert; local deduction succeeds then provider status fails; reversal can run twice because the guard/update and finance insert are not atomic; a status poll can race with a reversal (`app/api/withdrawals/request/route.ts:124-218`; `lib/withdrawals.ts:1-220`).

### 4.2 Refunds

The request route authenticates, validates the order/refund amount, creates a refund request and debits a balance bucket (`app/api/refunds/request/route.ts:1-218`). The refund schema includes original amount, requested amount, status and transaction/order relationships (`scripts/03-add-refunds.sql:1-40`). `balance_affected` records the bucket after the settlement migration (`scripts/101_finance_settlement.sql:38-40`).

Refund processing/retry/status is handled by `app/api/refunds/[refundId]/route.ts:48-113` and adjacent refund routes; the exact retry/status route inventory is **not found** beyond the cited dynamic route. The debit uses `GREATEST(0, ...)` (`app/api/refunds/request/route.ts:183-197`), so an insufficient balance becomes a zero-clamped balance rather than a rejected request. Failure restoration credits the bucket and inserts a finance record, but these are separate statements (`app/api/refunds/[refundId]/route.ts:48-113`). Paystack refund webhooks are **not found**.

Race/crash cases: duplicate refund requests for one order; two processors debit the same bucket; crash after debit before refund row/status persistence; provider refund accepted then local status update fails; failure restoration can run more than once; clamp can hide an amount larger than available; a retry can insert duplicate finance rows (`app/api/refunds/request/route.ts:178-218`; `app/api/refunds/[refundId]/route.ts:48-113`).

## 5. Data model

### 5.1 Repository-implied money tables

The initial schema creates orders, order_items, businesses and transactions with decimal money (`scripts/01-init-schema.sql:45-47,122-155`). Later scripts add withdrawal fields (`scripts/05-update-withdrawals.sql:1-11`), discount/price changes (`scripts/06-add-discounts.sql:1-80`; `scripts/07-restructure-prices.sql:1-80`), refunds (`scripts/03-add-refunds.sql:1-40`), service-fee/admin tables (`scripts/add-service-fee-system.sql:14-75`) and settlement/finance fields (`scripts/101_finance_settlement.sql:16-73`). Finance enhancements add refund/withdrawal metadata/indexes (`scripts/052_finance_enhancements.sql:4-41`).

Live schema facts from `information_schema.columns`:

| Table/columns | Live type/unit evidence | Null/default |
|---|---|---|
| `businesses.available_balance`, `pending_balance` | `numeric(12,2)`; application treats values as naira decimals | nullable, default `0` (`inspecting-live-schema-neon-run-sql-aa57.txt:303-320`) |
| `orders.total_amount` | `numeric(12,2)`; naira decimal convention | NOT NULL, no default (`...aa57.txt:703-710`) |
| `orders.payment_reference` | varchar; nullable; no unique constraint shown | nullable/no default (`...aa57.txt:713-730`) |
| `order_items.quantity` | integer | nullable, default 1 (`...aa57.txt:543-551`) |
| `order_items.item_price` | numeric(10,2); naira decimal convention | NOT NULL/no default (`...aa57.txt:553-560`) |
| `order_items.configuration` | jsonb | nullable (`...aa57.txt:563-570`) |
| `order_service_fees.service_fee_amount` | numeric, no scale in live metadata | NOT NULL/no default (`...aa57.txt:603-620`) |
| `finance_records.amount` | numeric, no scale in live metadata | NOT NULL/no default (`...aa57.txt:463-470`) |
| `admin_revenue.total_revenue`, `withdrawn_amount`, `available_balance` | numeric; decimal convention | nullable, default 0 (`...aa57.txt:13-41`) |
| `admin_withdrawals.amount` | numeric | NOT NULL/no default (`...aa57.txt:63-70`) |

Complete live definitions for every money-related table, including `transactions`, `withdrawals`, `refunds`, and all order columns, are present in the full `information_schema` result but the repository cannot establish their semantic unit beyond the decimal convention. Any unlisted column/type/default is **not found** in this report rather than guessed.

### 5.2 Mismatches and missing constraints

* SQL/application use numeric naira decimals, while the target design requires integer kobo (`scripts/01-init-schema.sql:45-47`; live schema above).
* `orders.payment_reference` is nullable and no unique constraint is shown; payment idempotency therefore cannot rely on it (`...aa57.txt:713-730`).
* `finance_records` has a related id/reference but no provider event id or uniqueness constraint in the live definition (`...aa57.txt:473-510`).
* `finance_records.amount` has no nonnegative/sign convention constraint; direction is free text in the live schema (`...aa57.txt:443-470`).
* Balance columns are nullable and have no nonnegative check shown (`...aa57.txt:303-320`).
* `order_items.quantity` is nullable and has no positive/max check shown (`...aa57.txt:543-551`).
* There is no established unique `(order_id, payment provider event id)`, unique provider reference, unique transaction per order/payment, unique refund idempotency key, unique withdrawal provider transfer id, or append-only trigger. These are **not found** in SQL/runtime evidence.

## 6. Read-only SQL for Neon

The following are SELECT-only diagnostics. They are templates intentionally using the live column names established above. If a referenced optional column is absent in a deployment, the result is **not found** and the query must be adapted after inspecting `information_schema`.

### 6.1 Duplicate payment references
```sql
SELECT payment_reference, COUNT(*) AS order_count, ARRAY_AGG(id) AS order_ids
FROM orders
WHERE payment_reference IS NOT NULL
GROUP BY payment_reference HAVING COUNT(*) > 1;
```
Bad result: one provider reference maps to multiple orders and verification can credit the wrong order or both.

### 6.2 Duplicate transactions per order
```sql
SELECT order_id, COUNT(*) AS transaction_count, ARRAY_AGG(id) AS transaction_ids
FROM transactions
GROUP BY order_id HAVING COUNT(*) > 1;
```
Bad result: likely duplicate payment credit, although legitimate partial/multiple payments must be decided explicitly.

### 6.3 Paid-order arithmetic
```sql
SELECT o.id, o.total_amount, COALESCE(SUM(oi.item_price * oi.quantity),0) AS item_sum,
       COALESCE(osf.service_fee_amount,0) AS service_fee,
       o.total_amount - (COALESCE(SUM(oi.item_price * oi.quantity),0)+COALESCE(osf.service_fee_amount,0)) AS delta
FROM orders o LEFT JOIN order_items oi ON oi.order_id=o.id
LEFT JOIN order_service_fees osf ON osf.order_id=o.id
WHERE o.payment_status='paid'
GROUP BY o.id,o.total_amount,osf.service_fee_amount
HAVING ABS(o.total_amount-(COALESCE(SUM(oi.item_price * oi.quantity),0)+COALESCE(osf.service_fee_amount,0))) > 0.01;
```
Bad result: stored order total disagrees with stored line items/fees; note this cannot detect client-injected item prices.

### 6.4 Transactions without finance records
```sql
SELECT t.id, t.order_id, t.business_id, t.amount, t.created_at
FROM transactions t LEFT JOIN finance_records f ON f.related_id=t.id
WHERE f.id IS NULL;
```
Bad result: financial movement lacks an audit record. The prior live run reported 17 rows.

### 6.5 Balance reconciliation
```sql
SELECT b.id, b.pending_balance, b.available_balance,
       COALESCE(SUM(CASE WHEN t.settlement_status IN ('pending','processing') THEN t.amount ELSE 0 END),0) AS tx_pending,
       COALESCE(SUM(CASE WHEN t.settlement_status IN ('settled','available') THEN t.amount ELSE 0 END),0) AS tx_available,
       COALESCE((SELECT SUM(w.net_amount) FROM withdrawals w WHERE w.business_id=b.id AND w.status IN ('processing','success','completed')),0) AS withdrawals,
       COALESCE((SELECT SUM(r.amount) FROM refunds r WHERE r.business_id=b.id AND r.status IN ('processing','success','completed')),0) AS refunds
FROM businesses b LEFT JOIN transactions t ON t.business_id=b.id GROUP BY b.id,b.pending_balance,b.available_balance;
```
Bad result: stored buckets do not reconcile to transaction credits less completed debits. Exact withdrawal/refund amount/status column names must be checked if this returns **not found**.

### 6.6 Negative/inconsistent balances
```sql
SELECT id, pending_balance, available_balance
FROM businesses
WHERE COALESCE(pending_balance,0) < 0 OR COALESCE(available_balance,0) < 0
   OR pending_balance IS NULL OR available_balance IS NULL;
```
Bad result: negative or null balance violates the target invariant.

### 6.7 Stuck withdrawals
```sql
SELECT id,business_id,amount,status,created_at,updated_at
FROM withdrawals
WHERE status IN ('pending','processing') AND created_at < NOW() - INTERVAL '1 day'
ORDER BY created_at;
```
Bad result: provider/local reconciliation is incomplete and funds may be reserved indefinitely.

### 6.8 Stuck refunds
```sql
SELECT id,order_id,original_amount,requested_amount,status,created_at,updated_at
FROM refunds
WHERE status IN ('pending','processing') AND created_at < NOW() - INTERVAL '1 day'
ORDER BY created_at;
```
Bad result: customer money is unresolved; retry/reversal policy needs operator action.

### 6.9 Orders pending over seven days
```sql
SELECT id,business_id,total_amount,payment_reference,payment_status,created_at
FROM orders
WHERE COALESCE(payment_status,'pending')='pending'
  AND created_at < NOW() - INTERVAL '7 days'
ORDER BY created_at;
```
Bad result: abandoned or payment-reconciliation backlog.

### 6.10 Money column types
```sql
SELECT table_name,column_name,data_type,numeric_precision,numeric_scale,is_nullable,column_default
FROM information_schema.columns
WHERE table_schema='public'
  AND table_name IN ('businesses','orders','order_items','transactions','withdrawals','refunds','finance_records','order_service_fees','admin_revenue','admin_withdrawals')
ORDER BY table_name,ordinal_position;
```
Bad result: any `numeric`, floating, text, nullable, or scale-bearing monetary column confirms migration work remains; target should be non-null integer/bigint kobo with explicit constraints.

## 7. Abuse protection and security

### 7.1 Public/sensitive endpoints

| Endpoint | Auth found | Rate limit found | Abuse enabled by absence/gap |
|---|---|---|---|
| `/api/orders` | Not found (`app/api/orders/route.ts:8-25`) | Not found | Order spam, price injection, inventory/customer abuse |
| `/api/payments/initialize` | Not found (`app/api/payments/initialize/route.ts:4-28`) | Not found | Paystack initialization spam, arbitrary amount/reference attempts |
| `/api/payments/verify` | Provider verification; user auth not found | Not found | Repeated verification and race attempts |
| `/api/payments/webhook` | Signature check found (`app/api/payments/webhook/route.ts:18-69`) | Not found | Replay/duplicate delivery unless idempotency is added |
| Login/forgot/reset/OTP/PIN | Routes exist in `app/api`; exact per-route limiter inventory is **not found** | No shared limiter found in money audit | Credential stuffing, OTP abuse, PIN brute force |
| `/api/withdrawals/*` | JWT checks found (`app/api/withdrawals/request/route.ts:82-93`; `app/api/withdrawals/[withdrawalId]/route.ts:15-25`) | Not found | Transfer spam, free-withdrawal race, balance exhaustion |
| `/api/refunds/*` | Auth checks appear in request route; complete route inventory **not found** | Not found | Refund spam/replay and provider abuse |
| save push token | Route existence found by search; exact auth/limiter **not found** | Not found | Token overwrite/spam and notification abuse |
| public menu routes | Public storefront behavior expected; exact route list/checks **not found** | Not found | Scraping and traffic exhaustion |

### 7.2 Maintenance and cron

`/api/migrations/fix-drinks-fk` and every maintenance route require individual authentication review. The complete route source and checks are **not found** in the retained evidence. The settlement cron contains authentication/heartbeat logic (`app/api/cron/settle-balances/route.ts:1-176`); exact deployment protection and replay safety are not established. A secret header alone does not provide idempotency or concurrency safety.

### 7.3 Admin routes

A complete per-route `/api/admin/*` inventory and role-check table is **not found** in the available evidence. The audit must not infer safety from directory naming. For each route, verify: authenticated identity, explicit admin role/claim, business/tenant scope, method validation, input schema, rate limit, and audit log. Missing evidence is a finding, not proof of protection.

### 7.4 Logs

Search found money-related provider/database logging sites, but a complete list of console statements and exact values is **not found** in the retained context. The required follow-up is a repository-wide search for `console.log`, `console.error`, `console.warn` in `app/api/payments`, `app/api/withdrawals`, `app/api/refunds`, `lib/paystack.ts`, `lib/withdrawals.ts`, and finance/cron files. Any log containing email, payment reference, transfer reference, token, raw provider response or bank details should be removed/redacted. Secret values were not printed in this report.

## 8. Implementation-plan inputs

### 8.1 Files/systems to change

1. **Server-recomputed totals:** storefront cart/add-on/checkout callers; `app/api/orders/route.ts`; menu/add-on schema/query layer; discount and `lib/service-fee.ts`; delivery pricing source; order schema/migrations.
2. **Payment idempotency:** `app/api/payments/initialize/route.ts`, `app/api/payments/verify/route.ts`, `app/api/payments/webhook/route.ts`, `lib/paystack.ts`; new provider-events/payment-attempt table; unique reference/event constraints.
3. **Atomic append-only ledger:** payment, settlement, withdrawal, refund and reversal routes/helpers; `finance_records` migration, immutable trigger/permissions, balance mutation procedures or DB transactions.
4. **Integer kobo:** all money schema columns, SQL migrations/backfill scripts, route validation, Paystack adapters, finance/admin pages, reports and tests.
5. **Rate limiting/protection:** login/password/OTP/PIN routes, orders, payment initialize/verify, refunds, withdrawals, push-token and public menu routes; cron/maintenance authentication and every admin route.

### 8.2 Safe ordering

1. Inventory and freeze current writes; add monitoring and read-only reconciliation queries.
2. Add nullable shadow kobo columns and dual-read/dual-write behind server feature flags; do not reinterpret existing decimal values in place.
3. Add idempotency/event tables and unique indexes concurrently after duplicate cleanup; make payment writes atomic before switching traffic.
4. Move order creation to DB-price recomputation while retaining legacy display fields for compatibility.
5. Migrate payment, settlement, withdrawal and refund flows to one ledger transaction/procedure; backfill ledger rows from trusted history with explicit manual review for ambiguous rows.
6. Convert balances and all money columns to bigint kobo after reconciliation; enforce NOT NULL, nonnegative/valid-status constraints after cleanup.
7. Enable rate limits and admin/cron authorization; then remove legacy decimal/client-total paths only after observability confirms no callers remain.

### 8.3 Neon migration safety

Adding nullable columns and indexes with `CREATE INDEX CONCURRENTLY` can generally be performed online, but every migration must be tested on a production-like branch. Backfills should be chunked and resumable. `ALTER COLUMN TYPE` can rewrite/lock tables and should not be assumed downtime-free. Unique indexes cannot be created until duplicates are cleaned. Adding `NOT NULL`/CHECK constraints should use `NOT VALID` then `VALIDATE CONSTRAINT` where supported, followed by enforcement. Exact lock behavior for this database/workload is **not found** and must be measured on a Neon branch.

### 8.4 Backfill/conversion

Existing `numeric` values must be converted using a documented rounding policy (`round(naira * 100)` only after confirming scale and avoiding repeated conversion). Every order item, total, fee, discount, balance, transaction, finance record, withdrawal, refund, admin revenue and admin withdrawal needs a source-unit audit. Mixed legacy 7.5% orders and tiered fees require preserving the historical charged amount and fee policy/version; blindly recomputing old orders would change history. Ambiguous rows identified by Section 6 must be quarantined for review.

### 8.5 Test checklist

* Order: stale client price, changed DB price, invalid quantity, add-on tampering, discount expiry, delivery tampering, duplicate idempotency key.
* Payment success: verify amount/currency/reference against recomputed order; exactly one transaction, one ledger event, one balance credit.
* Duplicate webhook: same event twice; same reference with different payload; replay after completion.
* Webhook + verify race: concurrent requests; assert one provider event, one credit, one finance record and consistent order.
* Failed transfer: provider rejection, timeout after acceptance, retry, reconciliation, reversal exactly once.
* Refund failure: provider failure, crash before/after debit, duplicate retry, amount greater than available; no clamp-based silent loss.
* Withdrawal limit race: concurrent requests at free-count boundary; assert one authoritative count and correct fee.
* Settlement rerun: two cron invocations, crash midway, 1,001 due rows, DST/time-zone boundary, already-settled row.
* Security: unauthenticated/admin-role-negative tests, per-IP/user/business rate limits, webhook signature/replay, log redaction.

### 8.6 Open questions

* Are order prices snapshots at checkout or always current DB prices? What happens when a menu price changes after checkout?
* Exact discount/coupon eligibility, stacking and `% OFF` rounding policy?
* Exact delivery fee policy and whether delivery is a business or platform charge?
* Are payment amounts always NGN and what provider-fee accounting is required?
* Should partial payments, split payments or multiple legitimate transactions per order be allowed?
* Exact free withdrawal count/window and fee amount; who bears Paystack transfer fees?
* Refund authority, maximum amount, partial refunds and refund deadline?
* Settlement schedule, holidays, timezone and treatment of failed/reversed payments?
* Which balance is refundable/withdrawable, and must overdrafts ever be possible?
* Required retention/redaction policy for provider payloads and audit records?
* Admin roles and route-by-route permissions?
* Rate-limit thresholds, trusted proxies and customer/business/IP keys?
* How should the existing live anomalies and ambiguous legacy 7.5% rows be resolved?

## Ranked ten highest-risk findings

1. Client can influence stored order prices/totals.
2. Verify/webhook race can double-credit balances.
3. No provider event/reference idempotency constraint.
4. Balance, transaction and finance writes are non-atomic.
5. Decimal naira/JavaScript number representation conflicts with integer-kobo target.
6. Withdrawal provider acceptance precedes durable local state.
7. Refund clamp can conceal overdrafts and restoration can duplicate.
8. Settlement has no row claiming and a 1,000-row partial-batch limit.
9. Public order/payment endpoints lack a limiter and, for order creation, authentication evidence.
10. Live integrity drift already includes orphaned transaction/finance records and paid-order arithmetic mismatches.

**Final limitation.** Any route, page, schema column, provider payload field, log statement, or SQL result not directly cited above is **not found** in the repository evidence retained for this audit; no claim should be filled in by assumption before the rebuild.
