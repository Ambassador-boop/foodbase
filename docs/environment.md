# Environment variables

Names only. Values never belong in the repository, in a commit, or in a log line.

Every variable the application reads is declared in `lib/env.ts` (server) and
`lib/env-public.ts` (anything prefixed `NEXT_PUBLIC_`, which is compiled into the
browser bundle). If you add a variable, add it to that schema first: the app fails
at start-up in production when a required variable is missing, and the error names
the variable, never its value.

## Where to set them

- Local: `.env.local` in the repository root (git-ignored).
- Vercel: Project → Settings → Environment Variables, for Production, Preview and
  Development as needed. Redeploy after changing one.

## Server only

| Name | Required | Used for |
| --- | --- | --- |
| `DATABASE_URL` | yes | Neon Postgres connection string (`@neondatabase/serverless`) |
| `JWT_SECRET` | yes | Signs and verifies the `auth_token` cookie. There is no fallback: a missing secret stops the app outside tests |
| `PAYSTACK_SECRET_KEY` | yes in production | Payment initialisation, verification, refunds, transfers, bank resolution, webhook signature check |
| `CLOUDINARY_API_KEY` | for uploads | Signed Cloudinary uploads |
| `CLOUDINARY_API_SECRET` | for uploads | Signed Cloudinary uploads |
| `BREVO_API_KEY` | for email | Transactional email (OTP, PIN codes, registration) |
| `BREVO_EMAIL` | no | Sender address for those emails |
| `ADMIN_NOTIFICATION_EMAIL` | no | Where new restaurant registrations are announced |
| `ONESIGNAL_REST_API_KEY` | for push | OneSignal REST calls via Median |
| `MAPBOX_TOKEN` | no | Server-side Mapbox calls (delivery time estimates) |
| `KUDISMS_TOKEN` | for SMS | KudiSMS API token |
| `KUDISMS_FUNDING_ACCOUNT_NUMBER` | for SMS top-up | Account the platform funds KudiSMS from |
| `KUDISMS_FUNDING_EXPECTED_NAME` | no | Name checked before a top-up is accepted |
| `CRON_SECRET` | yes for cron | Shared secret on `/api/cron/settle-balances` |
| `BETTERSTACK_HEARTBEAT_URL` | no | Heartbeat ping after the settlement cron runs |
| `RATE_LIMIT_SALT` | no | Salt for hashed rate-limit identifiers. Falls back to `JWT_SECRET` |
| `PIN_ENFORCEMENT` | no | `on` makes PIN tickets mandatory for money and bank changes |

## Public (compiled into the browser)

| Name | Used for |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | Absolute links in emails and notifications. Falls back to the request origin |
| `NEXT_PUBLIC_BASE_URL` | Paystack callback base. Falls back to `https://foodbase.ng` |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Unsigned Cloudinary uploads and `next/image` URLs |
| `NEXT_PUBLIC_ONESIGNAL_APP_ID` | Web push subscription |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Address search and maps in the browser |

## Notes

- `NODE_ENV` is read from the platform, not configured here.
- Nothing in the app reads `PAYSTACK_PUBLIC_KEY`, `BREVO_SMTP_KEY`,
  `CLOUDINARY_CLOUD_NAME` or `APP_BASE_URL`; older notes mentioned them and were
  wrong. Use the names above.
- `lib/env.ts` never prints values. Startup errors list missing names only.
