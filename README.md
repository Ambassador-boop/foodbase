# FoodBase

FoodBase is a Nigerian restaurant ordering and payments platform. A restaurant
publishes a menu and takes orders through its own storefront page. Customers pay
online with Paystack, either for delivery or for collection, or by scanning the
table code in the restaurant. The restaurant sees the order arrive, and the money
lands in its FoodBase balance, which it can withdraw to its bank account.

The platform earns a service fee on each order and a fee on withdrawals beyond
the monthly free allowance. Balances, settlements, refunds, withdrawals and fees
are calculated by Postgres functions named `fb_*`. Those functions are the source
of truth; the application around them does not reimplement the arithmetic.

## Stack

- Next.js 16 (App Router), React 19, TypeScript, Tailwind 4
- Neon Postgres via `@neondatabase/serverless`
- Paystack for payments, refunds and payouts
- Mapbox for delivery areas, Cloudinary for images
- OneSignal (through Median) for push, Brevo for email
- Vercel for hosting

## Local setup

```bash
pnpm install
# create .env.local with the variable names listed below, then:
pnpm dev                     # http://localhost:3000
```

Node 22 or newer, pnpm 10 or newer. The app needs a database before it will
start: `lib/env.ts` refuses to boot without the required variables and names the
ones that are missing. It never prints a value.

## Environment variables

Names only. See `docs/environment.md` for what each one is for and which are
required.

Server: `DATABASE_URL`, `JWT_SECRET`, `PAYSTACK_SECRET_KEY`, `CLOUDINARY_API_KEY`,
`CLOUDINARY_API_SECRET`, `BREVO_API_KEY`, `BREVO_EMAIL`, `ADMIN_NOTIFICATION_EMAIL`,
`ONESIGNAL_REST_API_KEY`, `MAPBOX_TOKEN`, `KUDISMS_TOKEN`,
`KUDISMS_FUNDING_ACCOUNT_NUMBER`, `KUDISMS_FUNDING_EXPECTED_NAME`, `CRON_SECRET`,
`BETTERSTACK_HEARTBEAT_URL`, `RATE_LIMIT_SALT`, `PIN_ENFORCEMENT`,
`FEATURE_DELIVERY_AREAS`, `FEATURE_TABLE_LABELS`, `FEATURE_SOUND_TEST`,
`ONESIGNAL_IOS_SOUND`, `ONESIGNAL_PUSH_SOUND`, `ONESIGNAL_ANDROID_CHANNEL_ID`,
`ONESIGNAL_IOS_INTERRUPTION_LEVEL`, `ONESIGNAL_IOS_BADGE_TYPE`,
`ONESIGNAL_IOS_BADGE_COUNT`.

Public (reach the browser): `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_BASE_URL`,
`NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_ONESIGNAL_APP_ID`,
`NEXT_PUBLIC_MAPBOX_TOKEN`.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Development server |
| `pnpm build` | Production build. Type errors fail it |
| `pnpm start` | Serve the production build |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` | Runs the type check; ESLint is not installed in this batch |
| `pnpm test` | Vitest, once |
| `pnpm test:watch` | Vitest, watching |

## Folder map

```
app/            routes: storefront, dashboard, admin, and app/api/*
components/     UI, grouped by area (dashboard, delivery, security, ui)
lib/            all logic: auth, db, payments, refunds, withdrawals, env
lib/api/        the request/response helpers every route uses
lib/delivery/   delivery areas, matching, pricing, estimates
hooks/          client hooks (PIN authorization, and others)
db/             new migrations from now on (see db/README.md)
migrations/     existing SQL, untouched
scripts/        existing operational scripts, untouched
tests/unit/     Vitest suites for pure logic
tests/sql/      rollback-only assertion scripts, run by hand on a Neon branch
docs/           environment, payments, deployment
```

## Tests

```bash
pnpm test
```

`tests/unit` covers the pure logic that decides money: service fees, refund
amounts and units, withdrawal policy, Paystack fees, delivery pricing. No test
opens a database connection or calls a provider.

`tests/sql` holds assertion scripts for `fb_settle_payment`,
`fb_request_refund` and `fb_reserve_withdrawal`. Each runs inside `BEGIN` and
ends with `ROLLBACK`, and raises an exception when an assertion fails. They are
for a Neon branch, never production, and CI does not run them.

## Database changes

Every change is one file in `db/migrations`, named `NNNN_short_name.sql`, with a
matching `NNNN_short_name.down.sql`. Both are wrapped in a transaction. Changes
are additive while old code is live: no drops and no renames in the same release
that stops using the old shape. Read `db/README.md` before writing one.

The `fb_*` functions are not changed by ordinary migrations.

## Deployment

See `docs/deployment.md`. Deploys are on Vercel, and a missing environment
variable stops the deployment at start-up rather than failing quietly later.
