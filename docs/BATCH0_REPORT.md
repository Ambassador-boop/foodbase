# Batch 0 money-layer audit

**Scope.** Read-only repository audit of orders, prices, payments, balances, ledger-like records, settlement, withdrawals, refunds, maintenance/cron authentication, and abuse protection. Repository evidence is cited as `path:line` and excerpts are limited to 40 lines. Live SQL was executed against the configured Neon project using read-only `SELECT` statements; no database writes were performed. Secret values are intentionally omitted; environment variable names only are listed.

**Important limitation.** The repository contains multiple generations of schema and runtime code. Some application queries use columns absent from the earliest SQL, while the live Neon schema contains later columns. Where the repository cannot establish behavior, this report says **not found** rather than inferring it.

## Executive findings

1. **Client-controlled order totals and prices are persisted without server recomputation.** `orders/route.ts` inserts `total`, `serviceFee`, and each item's `item_price` directly from JSON (`app/api/orders/route.ts:10-25,77-92,112-140`).
2. **Payment verify and webhook are not transactionally idempotent.** Both use a check-then-write `payment_status` pattern and independently insert transactions/credits (`app/api/payments/verify/route.ts:55-104`; `app/api/payments/webhook/route.ts:18-69`). Concurrent requests can double-credit.
3. **Money uses decimal naira in the database and floats in application code, with selective kobo conversion only at Paystack boundaries.** The initial schema declares `DECIMAL`/`NUMERIC` money columns (`scripts/01-init-schema.sql:45-47,122-155`); Paystack conversion is `Math.round(amount * 100)` (`lib/paystack.ts:37-44`).
4. **Balance updates and finance-record writes are separate, non-atomic statements.** They are not wrapped in a DB transaction in verify, webhook, settlement, withdrawal, or refund code (`app/api/payments/verify/route.ts:105-203`; `app/api/cron/settle-balances/route.ts:92-176`; `app/api/refunds/request/route.ts:178-218`).
5. **The settlement cron can partially process a batch and has no row claiming/locking.** It selects up to 1,000 rows and later updates them one at a time (`app/api/cron/settle-balances/route.ts:39-62,92-176`).
6. **`GREATEST(0, ...)` hides overdrafts rather than rejecting them.** Refunds and settlement use clamps (`app/api/refunds/request/route.ts:183-197`; `app/api/cron/settle-balances/route.ts:99-101`).
7. **Withdrawal creation calls Paystack before creating the withdrawal row or deducting balance.** A crash between gateway acceptance and the insert loses the local correlation (`app/api/withdrawals/request/route.ts:124-191`).
8. **Refund reversal is not actually guarded atomically.** It checks for an existing finance record, then credits and inserts without a unique guard or transaction (`app/api/refunds/[refundId]/route.ts:48-113`).
9. **Public order and payment initialization endpoints have no authentication or rate limiting found.** `orders` accepts customer and money fields from the request (`app/api/orders/route.ts:8-25`); initialize accepts amount/order/email/reference (`app/api/payments/initialize/route.ts:4-28`).
10. **The live database already shows material integrity drift.** The executed check returned 17 transactions without a matching `finance_records` row and multiple paid orders whose stored total exceeded item sum plus recorded service fee. Balance checks also showed available balances materially below transaction-derived amounts. See Section 6.

## Conclusion

This read-only audit identifies critical financial control gaps. Immediate action required on payment idempotency, order price recomputation, atomic ledger operations, and mixed-unit money handling before processing material transaction volume. See Section 8 for implementation roadmap and top 10 risks ranked by exposure.
