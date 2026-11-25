# Deployment

FoodBase runs on Vercel against Neon Postgres. One branch, one environment per
Vercel environment (Production, Preview, Development), each with its own
`DATABASE_URL`. Previews should point at a Neon branch, never at production data.

## Before the first deploy of a change

1. `pnpm install --frozen-lockfile`
2. `pnpm typecheck` — must be clean; `typescript.ignoreBuildErrors` is gone, so a
   type error now fails the build.
3. `pnpm lint`
4. `pnpm test`
5. `pnpm build`

The same four checks run in CI on every pull request (`.github/workflows/ci.yml`).

## Environment

Set every variable listed in `docs/environment.md` for the environment you are
deploying. The app fails at start-up in production when a required variable is
missing, and the message names the variable, never its value.

## Database changes

Never apply a schema change by hand in the Neon console for anything that ships
with code. Follow `db/README.md`: one forward file plus one rollback file per
change, additive only, applied to a Neon branch first, then production.

`/migrations` and `/scripts` hold historical SQL that has already been applied.
They are kept as a record and are not edited.

## Cron

`vercel.json` schedules `GET /api/cron/settle-balances` at 04:00 UTC (05:00 WAT)
every day. It requires `Authorization: Bearer $CRON_SECRET`, settles due
transactions with `fb_settle_due_transactions`, reconciles withdrawals, and pings
`BETTERSTACK_HEARTBEAT_URL` when configured. A missing `CRON_SECRET` returns 500
rather than running unauthenticated.

## Webhook

Point Paystack at `https://<your-domain>/api/payments/webhook` for every
environment you test payments in, and use that environment's secret key. See
`docs/payments.md`.

## After deploying

- Sign in as a business owner and place one small live order, then refund it. Both
  paths exercise settlement, the webhook and the refund reversal.
- Check `/api/csp-report` logs for blocked resources. The Content-Security-Policy
  ships in Report-Only mode first; read the reports before enforcing it.
- Watch the Vercel function logs for `[api]` lines. Every unexpected error is
  logged once with a request id, and that id is what the customer sees.
