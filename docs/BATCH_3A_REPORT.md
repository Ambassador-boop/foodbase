# Batch 3A: restaurant registration, onboarding, dashboard design system

Branch `batch-3a-registration-onboarding`, based on `main` @ `a3ec5b1`.
55 files changed, 7,614 insertions, 6 deletions (all six are lines replaced by a superset,
listed in §6).

Read this before merging. **§2 SQL must be run first.** The code is written to survive
_not_ having run it, but the new features degrade until it does.

---

## 1. What shipped

**Part 1: design system** (`components/dashboard/`, `docs/DESIGN_SYSTEM.md`)

Tokens were added to `app/globals.css` (brown `#8E3800`, cream surfaces, ink scale, status
pairs, 150/180ms motion) without touching an existing token. Type pairing is Instrument
Serif + Instrument Sans loaded with `next/font`, scoped to a `.dash-surface` wrapper, so
existing pages keep Plus Jakarta Sans.

Components: `PageHeader`, `SectionCard`, `StatTile`/`StatBar`, `DataTable` (sticky header,
sortable, mobile card fallback, pagination), `EmptyState`/`ErrorState`/`Notice`/`Skeleton`/
`PageSkeleton`/`TableSkeleton`, `FormField` + `TextField`/`TextArea`/`SelectField`/
`PasswordField`/`CheckboxField`/`CheckmarkList`, `Stepper`/`ProgressLine`, `ChecklistItem`,
`Toggle`/`TimeInput`, `toast`, `ConfirmDialog`, `StatusPill`/`StatusBadge`/`Counter`,
`MapContainer` (labelled placeholder slot), `SearchInput`/`FilterTabs`, and layout helpers
(`DashSurface`, `PageContainer`, `InsetPanel`, `Stack`, `Row`, `SplitLayout`, `StatGrid`,
`Rule`, `KeyValueList`). Formatters: `money`, `count`, `percent`, `dateTime`,
`relativeTime`, `formatNigerianPhone`, `statusTone`.

No existing dashboard page was restyled.

**Part 2: registration** (`/register/restaurant`, `POST /api/auth/register-restaurant`)

- Editorial two-column desktop (form left, photographic panel right), single column mobile.
  Slug auto-suggests from the restaurant name and checks availability live (debounced,
  rate limited, `aria-live`). Password strength meter with show/hide. Nigerian phone
  normalisation for `0803…`, `+234…`, `234…`, with spaces and hyphens.
- Reserved slugs blocked: admin, api, dashboard, login, register, account, accounts,
  security, pricing, terms, privacy, about, restaurants, payment-success, forgot-password,
  cancellation-policy, refund-policy.
- Owner + business created together; `role = 'business_owner'` and `hashPassword()` are the
  same ones `app/api/auth/login` uses; `is_active = true` so the business is live at once.
  If the business insert fails the user row is deleted (Neon's HTTP driver has no
  multi-statement transaction, so this is compensation, not a real rollback).
- Signed in with the existing JWT cookie plus the existing active-business cookie, then
  redirected to `/dashboard/onboarding`.
- Abuse protection: DB-backed IP and email rate limits (works across serverless
  instances), honeypot (`company_website`), disposable-domain block, duplicate phone/slug
  checks, and error copy that does not confirm anything beyond what login already does.
- Terms and privacy acceptance recorded with document versions, timestamp, IP and user
  agent (`registration_consents`). Optional: never fails a registration.
- Email (existing Brevo sender): welcome, verification link (72h, SHA-256 hashed token),
  and a new-registration notice to `ADMIN_NOTIFICATION_EMAIL` (falls back to
  `BREVO_EMAIL`). Verification is **non-blocking**: a dismissible banner in the dashboard
  layout until confirmed, with a resend action.
- Entry points: login page footer says "Register your restaurant"; homepage nav has the
  same link (desktop, and "Register" at ≤640px). `Get Started` is untouched.

**Part 3: onboarding** (`/dashboard/onboarding`, card on `/dashboard`, `/dashboard/hours`)

Checklist state is computed from real data every load (no stored flags):
profile + logo, bank account, withdrawal PIN, menu categories, first dish, opening hours,
delivery areas, table labels, notifications and sound test. Skips are stored per step
(`onboarding_skips`) and only offered for non-critical steps. Nothing blocks the dashboard.

Opening hours are additive: a new `business_hours` table (one row per weekday) with
`sell after close` defaulting to ON, and every save mirrors into the existing
`businesses.availability` JSONB so the current storefront info panel keeps working. The
storefront shows an open/closed badge with today's window; past-midnight windows are
handled. Delivery areas, table labels and the sound test are **"Coming next"** because
their routes do not exist yet, decided by `lib/features.ts` (checks the route on disk, with
a `FEATURE_*` env override), not a hard-coded flag. The day Batch 3B merges the page, the
step unlocks itself.

**Part 4: admin**

`/admin/businesses/registrations` lists self-registrations newest first with owner name,
email, verification state, phone, location, created time and a quick link, plus search and
an All/Active/Suspended filter. Suspend/Reactivate posts to a new route and only touches
`is_active`. Nav entry added under Businesses; the Alerts screen gained a registrations
strip with a 7-day count that is kept out of the existing financial alert total.

---

## 2. SQL to run FIRST (idempotent, additive)

File: `scripts/batch-3a-registration-onboarding.sql`. Also reproduced here.

```sql
BEGIN;

-- 1. Email verification state (non-blocking; access is never gated)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

-- 2. Verification tokens (only the SHA-256 hash is stored)
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(21) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user
  ON email_verification_tokens (user_id, created_at DESC);

-- 3. Terms / privacy acceptance audit
CREATE TABLE IF NOT EXISTS registration_consents (
  id VARCHAR(32) PRIMARY KEY,
  user_id VARCHAR(21),
  business_id VARCHAR(21),
  email VARCHAR(255) NOT NULL,
  terms_version VARCHAR(32) NOT NULL,
  privacy_version VARCHAR(32) NOT NULL,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(64),
  user_agent VARCHAR(400)
);
CREATE INDEX IF NOT EXISTS idx_registration_consents_user
  ON registration_consents (user_id, accepted_at DESC);

-- 4. Registration rate limiting (IP + email, hashed identifiers)
CREATE TABLE IF NOT EXISTS registration_attempts (
  id VARCHAR(32) PRIMARY KEY,
  bucket VARCHAR(16) NOT NULL,      -- 'ip' | 'email'
  identifier VARCHAR(255) NOT NULL, -- hashed, never the raw address
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_registration_attempts_lookup
  ON registration_attempts (bucket, identifier, created_at DESC);

-- 5. Opening hours per weekday (0 = Sunday .. 6 = Saturday)
CREATE TABLE IF NOT EXISTS business_hours (
  id VARCHAR(32) PRIMARY KEY,
  business_id VARCHAR(21) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_closed BOOLEAN NOT NULL DEFAULT TRUE,
  open_time TIME,
  close_time TIME,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, day_of_week)
);
CREATE INDEX IF NOT EXISTS idx_business_hours_business ON business_hours (business_id);

-- Accepting orders outside hours stays ON (no behaviour change for existing businesses)
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS accept_orders_outside_hours BOOLEAN NOT NULL DEFAULT TRUE;

-- 6. Onboarding skips (non-critical steps only)
CREATE TABLE IF NOT EXISTS onboarding_skips (
  id VARCHAR(32) PRIMARY KEY,
  business_id VARCHAR(21) NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  step_key VARCHAR(40) NOT NULL,
  skipped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, step_key)
);

COMMIT;
```

Every statement is `IF NOT EXISTS`, every new column is nullable or defaulted, no row is
updated, no column dropped, no type changed. Nothing touches payments, refunds,
settlements, withdrawals, PIN logic or the existing auth tables.

Rollback (only if needed):

```sql
DROP TABLE IF EXISTS onboarding_skips;
DROP TABLE IF EXISTS business_hours;
DROP TABLE IF EXISTS registration_attempts;
DROP TABLE IF EXISTS registration_consents;
DROP TABLE IF EXISTS email_verification_tokens;
ALTER TABLE businesses DROP COLUMN IF EXISTS accept_orders_outside_hours;
ALTER TABLE users DROP COLUMN IF EXISTS email_verified_at;
ALTER TABLE users DROP COLUMN IF EXISTS email_verified;
```

### If you do not run it

| Feature | Behaviour without the SQL |
| --- | --- |
| Registration | Works. Consent row, verification token and rate limiting are skipped (each is guarded). |
| Rate limiting | Falls open: no rows to count, so nothing is throttled. Honeypot and disposable-email checks still apply. |
| Opening hours | Saves into the existing `availability` JSONB only; storefront badge still works. |
| Onboarding | Checklist still computes; skipping a step fails silently instead of persisting. |
| Admin registrations | Works (`is_active` is pre-existing). The Alerts strip works. |

---

## 3. Files

### New

```
app/register/restaurant/page.tsx                  public registration page
components/registration/registration-form.tsx      form, slug check, password meter
components/registration/registration-panel.tsx     photographic side panel
app/api/auth/register-restaurant/route.ts          create owner + business, sign in, email
app/api/auth/register-restaurant/slug/route.ts     live availability check
app/api/auth/verify-email/route.ts                 consume link / resend
app/dashboard/onboarding/page.tsx                  checklist screen
app/dashboard/hours/page.tsx                       per-day hours editor
app/api/business/hours/route.ts                    read + save hours
app/api/business/onboarding/route.ts               skip / unskip a step
app/admin/businesses/registrations/page.tsx        new registrations list
app/api/admin/businesses/registrations/route.ts    registrations feed
app/api/admin/businesses/[businessId]/status/route.ts  suspend / reactivate
components/dashboard/*.tsx (16 files)              the design system
components/dashboard/tokens.ts                     tones + formatters
components/dashboard/onboarding-checklist.tsx      client checklist
components/dashboard/setup-progress-card.tsx       dashboard progress card
components/dashboard/verify-email-banner.tsx       non-blocking verification banner
components/dashboard/hours-editor.tsx              hours editor
lib/onboarding.ts                                  computes checklist state from data
lib/business-hours.ts                              server: read/save hours
lib/hours-shared.ts                                pure: isOpenAt, describeToday
lib/features.ts                                    route-existence feature checks
lib/registration/validation.ts                     shared zod schema + rules
lib/registration/rate-limit.ts                     DB-backed limiter
docs/DESIGN_SYSTEM.md                              design system reference
docs/BATCH_3A_REPORT.md                            this report
scripts/batch-3a-registration-onboarding.sql       migration to run first
scripts/verify-batch-3a.ts                         66 logic checks, no DB needed
```

### Modified (all additive)

```
app/globals.css                 +138 tokens, utilities, reduced-motion rules
app/layout.tsx                  +2 next/font faces on <html> (existing font kept)
next.config.mjs                 +images.remotePatterns for images.unsplash.com
app/page.tsx                    +"Register your restaurant" nav link
app/login/page.tsx              +registration link, +?registered / ?email_verified notice
app/dashboard/layout.tsx        +verification banner, +Setup and Opening Hours nav items
app/dashboard/page.tsx          +setup progress card (renders nothing when complete)
app/[slug]/page.tsx             +open/closed badge in the storefront hero
app/api/restaurants/[slug]/menu/route.ts   types for the hours fields
app/api/user/profile/route.ts   returns email_verified, with a fallback query
lib/email.ts                    +3 senders on the existing Brevo transport
components/admin/shell.tsx      +nav item and page title
components/admin/types.ts       +optional newRegistrations count
app/api/admin/attention/route.ts +7-day registration count (separate from total)
app/admin/attention/page.tsx    +registrations strip linking to the list
```

---

## 4. Assumptions

1. `main @ a3ec5b1` is the merge base; nothing from Batch 2b/2c/2d was altered.
2. Every self-registered restaurant is a single owner with one business, which matches the
   existing `businesses.owner_id` shape and the dashboard's business switcher.
3. Nigerian states are validated against the list already used by the storefront
   (`NIGERIAN_STATES` in `lib/registration/validation.ts`).
4. "Accepting orders outside opening hours" stays **on** by default; the setting is
   additive and optional, and no order-placement code was modified in this batch.
5. Registration is a public endpoint, so the duplicate-email message is explicit (it is the
   same information the login page already reveals) rather than silent, because a silent
   failure would strand genuine owners.
6. `ADMIN_NOTIFICATION_EMAIL` is the admin address for new-registration email; if it is
   unset the code falls back to `BREVO_EMAIL` and otherwise sends nothing.
7. Feature availability for delivery areas, table labels and sound test is read from the
   filesystem at request time, with `FEATURE_*` env overrides for environments without
   source (for example a slim container).

---

## 5. Verification

Run in the sandbox against this branch:

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | 22 errors, **identical set to `main`** (same four pre-existing issues, only line numbers shifted) |
| `npx next build` | exit 0, **zero warnings**, all new routes compiled (`/register/restaurant`, `/dashboard/onboarding`, `/dashboard/hours`, `/admin/businesses/registrations`) |
| `npx tsx scripts/verify-batch-3a.ts` | **66/66** checks pass: slug shape + all 17 reserved words, slug suggestion (accents, apostrophes, hyphens, 40-char cap, reserved avoidance), Nigerian phones (9 valid/invalid cases + display format), password scoring, disposable domains, zod schema (including unknown state rejection), open/closed arithmetic including past-midnight and all-closed weeks |
| Rendered pages (`next start` + curl) | `/register/restaurant` 200 (42KB), `/login` 200, `/` 200; both entry points contain "Register your restaurant"; no emoji, no `gradient`, no "undefined" in rendered output |
| Feature checks | delivery areas / table labels / sound test all report unavailable with their batch labels; env overrides work both ways |

**Not verified in the sandbox:** anything needing a live database. There are no Neon
credentials here, so the actual insert path, duplicate-email 409, slug availability,
hours persistence and the admin status change have not been executed end to end. The rules
they depend on are covered by the 66 checks, and the build proves the routes compile, but
please run the §7 sequence after the SQL.

---

## 6. The six deleted lines

Each is replaced by a superset; no behaviour was removed.

1. `app/api/user/profile/route.ts` one-line GET, now formats the same query with an
   `email_verified` fallback.
2. `app/dashboard/layout.tsx` `<div className="p-4 lg:p-6">{children}</div>`, now the same
   div with the verification banner above `{children}`.
3. `app/layout.tsx` font import, now includes Instrument Serif and Sans.
4. `app/layout.tsx` `<html className>`, now also carries the two new font variables.
5. `app/login/page.tsx` `import { useState }`, now `useEffect, useState`.
6. `app/login/page.tsx` "Contact your administrator to register a new account": kept, and a
   "Register your restaurant" link was added above it.

---

## 7. Test after the SQL

1. Register a new restaurant. Expect: redirected to `/dashboard/onboarding`, the business
   visible on the storefront immediately, welcome + verification emails, admin notice.
2. Try the same email again → 409 with a sign-in hint. Same slug → taken message with a
   free suggestion. Same phone → 409.
3. Click the verification link → `?email_verified=1`, banner disappears. Click it again →
   expired path, no crash.
4. Submit the same form 6+ times quickly from one IP → 429 with `Retry-After`.
5. Fill the hidden `company_website` field → generic 400, no account created.
6. `/dashboard/onboarding`: with a fresh business, profile/logo/bank/PIN/menu are open and
   delivery areas, tables and sound test show "Coming next" with their batch labels.
7. `/dashboard/hours`: save a past-midnight window (18:00–02:00) and confirm the storefront
   badge is open at 01:00 and closed at 03:00.
8. `/admin/businesses/registrations`: newest first, suspend one, confirm the storefront is
   closed for customers and Reactivate restores it. Alerts shows the 7-day count.
9. Widths: `/register/restaurant` and `/dashboard/onboarding` at 360, 390, 1024, 1280,
   1440 with a long restaurant name. No horizontal scroll.

---

## 8. Deliberate follow-ups (not done here)

- Existing dashboard pages are still in their old style; they are migrated batch by batch
  per §8 of `docs/DESIGN_SYSTEM.md`.
- `/login` still reads "Welcome Back" and the homepage copy still uses "seamless" and
  "effortless". Changing existing marketing copy was out of scope for an additive batch;
  it is a one-file edit whenever you want it.
- Delivery areas, table labels and the notification sound test unlock themselves when
  Batch 3B/3C add their routes.
- `business_hours` is written but the order-placement path still does not check it, by
  design: accepting orders outside hours remains on.
