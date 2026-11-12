# Batch 3A-fix — orders outside hours, and font loading

**Branch:** `batch-3a-fix`, from `batch-3a-registration-onboarding @ 65b5a5e`
**Date:** 12 November 2026
**SQL required:** none. This batch adds no tables and no columns. The columns it
reads (`businesses.accept_orders_outside_hours`) and the `business_hours` table
are the ones Batch 3A already created.

---

## 1. What was wrong

`businesses.accept_orders_outside_hours` and the `business_hours` table existed,
and `lib/business-hours.ts` could already answer "is this restaurant open right
now?" — but nothing enforced it:

- `app/api/orders/route.ts` never asked. A closed restaurant with the setting
  off still took money.
- The cart and checkout never asked. They let the customer fill in the form and
  press Pay, then the server accepted it.
- So the only sign of the setting was the storefront badge and a line of helper
  text in the dashboard: pure decoration.

Two smaller faults came out of the same review:

- The open/closed arithmetic used `new Date()` on the server, which on Vercel is
  UTC. Lagos is UTC+1, so every restaurant opened and closed an hour late.
- `app/layout.tsx` loaded Instrument Serif and Instrument Sans for every page,
  including the storefront, although only the dashboard design system uses them.

---

## 2. What changed

### The rule, in one place

`lib/hours-shared.ts` (client-safe, additive) gained:

| export | what it does |
| --- | --- |
| `lagosNow(base?)` | a Date whose local getters read Africa/Lagos wall clock. Lagos has no DST, so the fixed +1h shift is exact. |
| `formatTime12h('09:00')` | `9:00 AM` — for copy only, never for stored values. |
| `hasConfiguredHours(days)` | true only when at least one day is open **with both** times. Everything that must never block keys off this. |
| `nextOpeningAt(days, now)` | `{ label: 'Opens today at 10:00 AM', dayOffset, openTime, minutesUntil }` or `null`. Handles same-day, tomorrow, weekday names, and past-midnight windows. |
| `evaluateOrdering(days, setting, now)` | the whole decision: `{ allowed, openNow, hoursConfigured, opensAt }`. |
| `isOrderingPaused(hours)` | the same rule, from a storefront payload. |
| `type StorefrontHours` | the shape the menu endpoint returns and the screens read. |

`lib/business-hours.ts` wraps `evaluateOrdering` as `getOrderingStatus(businessId)`,
which reads the table and is **fail-open**: a missing table, a missing column, a
failed query or an empty schedule all answer "allowed".

### The enforcement matrix

| setting | hours configured | open now | order |
| --- | --- | --- | --- |
| on (default) | any | any | **allowed** — byte-for-byte today's behaviour |
| off | no | — | **allowed** (never block on missing data) |
| off | yes | yes | **allowed** |
| off | yes | no | **refused** — HTTP 409 |

### Server: `app/api/orders/route.ts`

The first thing that happens after the business is verified, and before the first price is read:

```
409 { error: 'This restaurant is not taking orders right now.',
      code: 'RESTAURANT_CLOSED',
      opensAt: 'Opens today at 10:00 AM' }
```

It runs before "Server-side re-pricing", so a closed restaurant can never reach
`order_items`, service fees or a payment initialisation. The call sits inside its
own `try`, and a thrown error logs and lets the order through: an hours outage
must never cost a customer their order.

### Storefront: the menu payload

`app/api/restaurants/[slug]/menu/route.ts` now computes `hours` with `lagosNow()`
and adds `hoursConfigured` and `opensAt`, so the cart and checkout see exactly
what the server will decide. It is additive: the existing fields are unchanged.

### Cart and checkout

New `components/storefront/ordering-paused-notice.tsx` (presentational, no
hooks): the calm notice and the one-line note that sits under a disabled button.

- **Cart** (`app/[slug]/cart/page.tsx`): the notice sits at the top of the order
  area with the next opening time; Proceed to Checkout is disabled on both the
  sticky mobile bar and the desktop summary, each with the reason underneath.
  Quantity steppers, add-on edits, remove and "back to menu" all keep working.
- **Checkout** (`app/[slug]/checkout/page.tsx`): same notice at the top, Pay
  disabled on desktop and on the sticky mobile bar with the reason, and a
  submit-time guard that never posts. If the restaurant closes between page load
  and the tap, the 409 is caught, the button stays disabled, and the message
  appears in the **existing** error state — the same words, with the next
  opening. The duplicate top notice is suppressed in that one case so the
  message is not printed twice.
- Copy: "Ordering paused / *Mama Nkechi's Kitchen* isn't taking orders right
  now. Opens today at 10:00 AM. Your cart is saved, so you can keep browsing and
  changing items. Nothing is charged while ordering is paused."

### Dashboard: `components/dashboard/hours-editor.tsx`

- The toggle description now states exactly what each state does, including
  "Orders already placed are never affected."
- The section carries "Times are read in West Africa Time (Lagos), whatever
  timezone they are ordering from."
- New live preview block — **"Customers will see"** — driven by the same
  functions as the server, so it cannot drift. Four states: no schedule, open,
  closed with orders still accepted, closed with ordering paused.
- The "Right now" row and the open/closed chip now read the Lagos clock too.
  Before, they read the browser/server clock, which disagreed with what
  customers saw.

### Fonts: `lib/editorial-fonts.tsx`

The two `next/font` loaders moved out of `app/layout.tsx` into
`lib/editorial-fonts.tsx`, unchanged (same families, weights, styles, `display:
'swap'`, and **the same CSS variable names** `--font-editorial` and
`--font-dashboard-ui`). Three layouts now load them:

| layout | how |
| --- | --- |
| `app/dashboard/layout.tsx` | client layout → `useEditorialFontRoot()` + `editorialFontClassName` on the existing root div |
| `app/admin/layout.tsx` | server layout → `<EditorialFontScope>` |
| `app/register/layout.tsx` | new file, server layout → `<EditorialFontScope>` |

The scope does two things, because the design system is used in two ways: the
`__variable` classes cover the whole subtree for first paint, and a mount effect
puts the same two values on `document.documentElement` so Radix dialogs and
sonner toasts (which render into `document.body`, outside the wrapper) keep
their faces, exactly as when the variables lived on `<html>`. The effect removes
them on the way out, so a storefront page never inherits them.

`app/layout.tsx`: the only edit is removing the two loaders and their two
variable classes. Plus Jakarta Sans and Geist Mono are untouched, so nothing on
the storefront changed appearance.

---

## 3. Verification

| check | result |
| --- | --- |
| `npx tsc --noEmit` | **22 errors, identical to `main`** — the same pre-existing ones (`addon-form`, `cloudinary`, `notification-service`, …), nothing new |
| `npx next build` | **compiles clean, 133/133 pages, zero warnings** |
| `npx tsx scripts/verify-batch-3a-fix.ts` | **79/79 passed**, run under `TZ=UTC`, `Africa/Lagos`, `America/New_York`, `Asia/Tokyo` — identical results in all four |
| route smoke test (`next start`, `curl`) | `/`, `/login`, `/register/restaurant`, `/pricing`, `/about`, `/security`, `/terms` → **200**; `/dashboard`, `/admin` → **307 to /login** when signed out (correct) |
| widths | measured in real Chrome at 360 / 390 / 768 / 1024, see below |

The 79 checks cover: the Lagos shift (and that it does not mutate its input),
open/closed boundaries at 08:59/09:00/20:59/21:00, past-midnight windows
(open at 01:30 for an 18:00–02:00 day, closed at 02:30, correct next opening),
all four decision cases, `null` and half-filled day rows, **all 168 hour-slots of
a week with the setting ON never blocking**, the setting OFF blocking exactly the
84 closed hours, next-opening copy for today/tomorrow/Monday/Sunday,
`formatTime12h` edge cases (00:00, 12:00, 09:05), the client mirror, and **client
and server agreeing on all 168 hour-slots**. The last section asserts the source
structure of the gate (it exists, runs after business verification, before
pricing and before any insert, returns 409 with the agreed copy, and the catch
path allows the order) plus the font moves.

### Width measurements (headless Chrome, real geometry)

| width | notice | no horizontal overflow | pay / checkout button | sticky bar |
| --- | --- | --- | --- | --- |
| 360 | 332 × 147 | yes | 332 px wide, **disabled** | 129 px tall, clears the cart's `pb-44` |
| 390 | 362 × 147 | yes | 362 px, disabled | 129 px |
| 768 | 740 × 112 | yes | 740 px, disabled | 129 px |
| 1024 | 980 × 91 | yes | 323 px (sidebar), disabled | hidden, as designed |

Every element was walked for `scrollWidth > clientWidth` and for a right edge
past the viewport: no offenders at any of the four widths. The notice is
`flex-wrap` with a `shrink-0` dot, so a long restaurant name wraps instead of
overflowing (measured with "The Place Restaurant and Lounge, Victoria Island").

### Font payload, measured per route from the build output

| route | font files | bytes |
| --- | --- | --- |
| `/`, `/login`, `/pricing`, `/about` | **2** | **49 KB** |
| `/dashboard`, `/admin`, `/register/restaurant` | 5 | 108 KB |

The storefront stops downloading ~59 KB and three requests. The five-file
routes carry the same markup as before, so no dashboard screen changed
appearance.

---

## 4. Assumptions

1. **Lagos is UTC+1 all year.** No DST, so a fixed offset is exact; `Africa/Lagos`
   and zone data are not needed on the server.
2. **"Configured" means a real schedule** — at least one day open with both an
   opening and a closing time. A blank or half-filled week counts as "no hours",
   which allows orders rather than guessing.
3. **Fail-open everywhere.** If hours cannot be read, the order is allowed. The
   setting can only ever remove a refusal, never create one from missing data.
4. **The gate is order creation only.** Browsing, cart edits, and the dashboard
   are untouched; nothing else in the app calls it.
5. **The next opening is computed from the weekly schedule**, not from holidays
   or one-off closures (there are none in the data model).
6. **One badge change on the storefront.** When a business has no schedule,
   the open/closed badge is now hidden instead of reading "Closed now". It was
   claiming something untrue while orders were being accepted, and there is
   nothing honest to show. This is the only visual change outside the new
   states. Say the word and I will put the old badge back.
7. **Checkout checks the pause before field validation**, so a paused restaurant
   says "not taking orders" rather than "Full name is required".

---

## 5. Not done, and why

- **The DB write path was not executed.** The sandbox has no Neon credentials,
  so I could not run a live 409 against a real database. The decision function,
  the gate's position in the route, and the response shape are asserted by the
  verification script; the manual sequence below closes the last gap in two
  minutes.
- **No new SQL.** Nothing in this batch needs a migration.
- **No screenshots of the live pages**, for the same reason: the cart and
  checkout need a real restaurant row. The component geometry was measured in a
  real browser instead (table above).
- **Not merged, not deployed.** Branch only.

### Two-minute manual proof (staging or local with a database)

1. Dashboard → Hours → set Monday–Sunday 09:00–21:00, turn **off** "Keep
   accepting orders when we are closed", save.
2. Open the storefront cart in a window where Lagos time is outside those hours
   (or set the window to end a minute from now and wait). Expect: the notice at
   the top, the disabled checkout button, and the reason underneath. Menu
   browsing and quantity edits still work.
3. `curl -X POST /api/orders -d '{…valid cart…}'` from a shell, skipping the UI
   entirely. Expect `409` with `{"code":"RESTAURANT_CLOSED","opensAt":"Opens …"}`,
   and **no** new row in `orders`.
4. Turn the setting back **on** and repeat step 3 within the same closed window.
   Expect the order to be created exactly as before.
5. Delete all rows in `business_hours` for that business, keep the setting off,
   repeat step 3. Expect the order to be created (never block on missing data).

---

## 6. Files

**Modified (11)**

| file | change |
| --- | --- |
| `app/api/orders/route.ts` | +35: the 409 gate, after business verification, before pricing |
| `app/api/restaurants/[slug]/menu/route.ts` | +29: Lagos clock, `hoursConfigured`, `opensAt` in the payload |
| `lib/hours-shared.ts` | +162: Lagos clock, formatting, next opening, decision, client mirror |
| `lib/business-hours.ts` | +49: `getOrderingStatus`, fail-open, re-exports |
| `app/[slug]/cart/page.tsx` | notice, disabled checkout, bottom padding |
| `app/[slug]/checkout/page.tsx` | notice, disabled pay, submit guard, 409 handling |
| `app/[slug]/page.tsx` | honest badge: hidden when unconfigured, next opening when closed |
| `components/dashboard/hours-editor.tsx` | truthful helper text + live "Customers will see" preview |
| `app/layout.tsx` | -2 font loaders, -2 variable classes (nothing else) |
| `app/dashboard/layout.tsx` | font scope on the existing root div |
| `app/admin/layout.tsx` | wrapped in `EditorialFontScope` |

**Added (5)**

| file | what |
| --- | --- |
| `components/storefront/ordering-paused-notice.tsx` | the notice and the button note |
| `lib/editorial-fonts.tsx` | the two loaders, `EditorialFontScope`, `useEditorialFontRoot` |
| `app/register/layout.tsx` | loads the pairing for the registration page |
| `scripts/verify-batch-3a-fix.ts` | 79 checks, no DB needed |
| `scripts/render-paused-notice.tsx` | renders the notice to HTML for the width measurements |

**Removed: nothing.** Payments, refunds, withdrawals, settlement, PIN and auth
are untouched: no file under `app/api/payments`, `lib/payment*`, `lib/pin*`,
`app/dashboard/finance`, `app/dashboard/security` or any auth route appears in
this diff. `app/layout.tsx` is the only file with deletions, and they are
exactly the two font loaders and two class names this task asked me to remove.
