# Payments, refunds and payouts

FoodBase takes money through Paystack and records every movement in Postgres.
The SQL functions named `fb_*` own the arithmetic (balances, settlement, refunds,
fees, withdrawals). Application code calls them; it never recalculates money.

## Webhook

Paystack calls `POST /api/payments/webhook` with a `x-paystack-signature` header.

- The signature is an HMAC-SHA512 of the raw request body, keyed with
  `PAYSTACK_SECRET_KEY`, compared with `crypto.timingSafeEqual`. Keep it that way.
- Handled events: `charge.success`, `transfer.success`, `transfer.failed`,
  `transfer.reversed`, `refund.processed`, `refund.failed`, `refund.pending`,
  `refund.processing`. Anything else is acknowledged and ignored.
- `GET /api/payments/webhook?reference=…` (or `?trxref=…`) redirects the customer
  to `/payment-success`.

Set the webhook URL in the Paystack dashboard (Settings → API Keys & Webhooks) to
`https://<your-domain>/api/payments/webhook`. The callback URL is
`https://<your-domain>/payment-success`.

## Money in

1. `POST /api/orders` re-prices the whole cart from the database and stores the
   order. The browser's totals are only compared, never charged.
2. `POST /api/payments/initialize` sets a `payment_reference` on the order and asks
   Paystack for an authorisation URL.
3. Paystack sends `charge.success`; `/api/payments/verify` is the customer-return
   path. Both call `settlePaystackPayment`, which records the payment through
   `fb_settle_payment`. Whichever arrives second sees the payment as already
   settled.

Amounts are stored in naira and sent to Paystack in kobo (`Math.round(naira * 100)`).

## Refunds

- `POST /api/refunds/request` validates the request, then `fb_request_refund`
  decides whether the refund is allowed and moves the balance.
- The amount read back is `refund_amount` (naira) via `lib/refund-amount.ts`.
  The legacy `amount` column is kobo. Reading the wrong one is a 100x error.
- `fb_reverse_failed_refund` returns the balance when Paystack rejects a refund.
- A refund larger than what the customer actually paid is refused by the function
  (`exceeds_refundable`), and the service fee is not refundable.

## Payouts (business withdrawals)

- `POST /api/business/withdrawals` reserves the payout with `fb_reserve_withdrawal`,
  then creates a Paystack transfer recipient and initiates the transfer.
- The first `FREE_WITHDRAWALS_PER_MONTH` (3) withdrawals of the calendar month are
  free; from the 4th, `OVERAGE_FEE_NGN` (₦500) is charged. The month boundary is
  passed in as `p_month_start`, computed in Africa/Lagos by `watMonthStartUtc()`.
- Minimum withdrawal: `MIN_WITHDRAWAL_NGN` (₦100). Constants live in
  `lib/withdrawal-policy.ts`.
- On success, `fb_record_withdrawal_fee` credits the fee to admin revenue exactly
  once, and `lib/paystack-fees.ts` records what Paystack charged to send it.
- A failed or reversed transfer calls `fb_reverse_failed_withdrawal`.

## Provider fees

Paystack's transfer pricing is in `lib/paystack-fees.ts` (₦10 up to ₦5,000, ₦25 to
₦50,000, ₦50 above, plus ₦50 stamp duty on transfers of ₦10,000 or more). Transfer
objects do not carry a fee, so the figure is computed and marked `computed`; if
Paystack ever returns one, it wins and is marked `provider`.

## Testing without moving money

Use Paystack test keys locally. Never point a development environment at live keys,
and never run the settlement cron against production data.
