# Batch 3B — Delivery areas and table labels

Branch: `Batch-3B` (branched from `main` at `dea5f95`).
Scope: docx #10 (delivery areas and fees) and #21 (table labels), built to the
DoorDash standard, on top of the Batch 3A design system.

---

## 1. What ships

### (a) Delivery areas

| Piece | Where |
| --- | --- |
| Geometry, area matching, fee rules, validation | `lib/delivery/geo.ts`, `lib/delivery/matching.ts`, `lib/delivery/pricing.ts`, `lib/delivery/types.ts` |
| Schema detection (`hasDeliverySchema`) so the app runs before the SQL | `lib/delivery/pricing.ts` |
| Mapbox wrappers (browser + server) | `lib/mapbox/client.ts`, `lib/mapbox/server.ts` |
| Read-only quote endpoint used by checkout | `POST /api/delivery/quote` |
| Dashboard CRUD for areas and prep time | `GET/POST/PATCH /api/business/delivery`, `POST/PATCH/DELETE /api/business/delivery/areas[/:id]` |
| Isochrone proxy (server-side token) | `POST /api/business/delivery/isochrone` |
| Address search proxy, restricted to Nigeria | `GET /api/delivery/address-search` |
| Map editor + area management screen | `app/dashboard/delivery/page.tsx`, `components/dashboard/delivery/*` |
| Checkout address search component | `components/delivery/address-search.tsx` |
| Admin read-only view | `GET /api/admin/businesses/:id/delivery-areas` + card on `app/admin/businesses/[businessId]/page.tsx` |

Area types: **Flat**, **Radius**, **Polygon** (drawn on the map), **Drive time**
(Mapbox Isochrone). Each area carries a name, fee in naira, optional minimum
order, optional free-delivery threshold, active flag and a priority used only to
break ties between areas of identical size.

### (b) Table labels

| Piece | Where |
| --- | --- |
| Label storage, bulk sequence creation, reorder, rename, pause, delete | `GET/POST/PATCH /api/business/table-labels`, `PATCH/DELETE /api/business/table-labels/:id` |
| Manager screen + printable branded QR sheet | `app/dashboard/tables/page.tsx`, `components/dashboard/tables/table-labels-manager.tsx` |
| Print stylesheet (A4, 3 cards per row, app chrome hidden) | `app/dashboard/tables/qr-print.css` |
| Storefront `?table=` capture | `app/[slug]/page.tsx` |
| Checkout table grid, preselected from the QR link | `app/[slug]/checkout/page.tsx` |
| Server validation against active labels, stored on the order | `app/api/orders/route.ts` |

QR codes point at `/{slug}?table=<label>`. The label is a **preselection only**:
the order API re-validates it against active labels and rejects anything else
with `INVALID_TABLE_LABEL`, so a hand-edited URL cannot invent a table.

---

## 2. Server authority (unchanged in principle, extended in scope)

Pricing was already server-side after Batch 2b. 3B keeps that contract and extends
it to fees:

1. Checkout posts **no fee, no area id**. It posts a delivery type, the basket and
   the dropped pin.
2. `POST /api/orders` re-derives everything: it loads the business's active areas
   server-side, runs the point-in-area test itself, computes the fee, minimum
   order and free-delivery threshold, and writes the result onto the order.
3. A client that posts `delivery_fee` or `delivery_area_id` has those fields
   ignored — the request body has no path to the stored value. Only an *address
   coordinate pair* is accepted, because the customer is the one who knows where
   they live; the fee for that point is still computed by us.
4. `PRICE_MISMATCH` behaviour is untouched: subtotal and total are recomputed from
   the database menu, and the fee is added to the server total, so a tampered
   basket still fails the same way it does today.

`lib/pricing.ts` still exports `DELIVERY_FEE` (₦1,000). Nothing in the checkout
reads it any more; it is kept because the brief asked for it to stay, and because
`LEGACY_DELIVERY_FEE` in `lib/delivery/matching.ts` is what the pre-migration
fallback uses.

### How the point-in-area test works

All of it is in `lib/delivery/geo.ts` and `lib/delivery/matching.ts`, with no
dependency on Postgres or PostGIS:

- **Radius** — `haversineMeters(point, centre) <= radius_m + 1 m`. The one-metre
  tolerance is the boundary rule: a pin dropped exactly on the rim is *inside*,
  which is what a customer standing on that street expects. Ten metres past the
  rim is already outside (verified).
- **Polygon / isochrone** — the stored GeoJSON ring is normalised once
  (`normaliseRing`: `[lng, lat]` → `{lat, lng}`, duplicate closing vertex removed,
  repeated vertices dropped), then a standard ray-cast (`pointInRing`) answers
  inside/outside, with hole support for MultiPolygon. Two guards make the edges
  behave: a point within **1 m of any edge segment** counts as inside
  (`distanceToSegmentMeters`), and a point exactly on a vertex counts as inside
  (collinear ray-cast is deliberately exact for that case). Both the edge and the
  corner cases are verified.
- **Flat** — covers everything; no geometry test.
- **Matching** — `matchArea()` keeps every active area that contains the point,
  sorts by stored `area_sqm` ascending (smallest first), then by `priority`
  ascending, then by creation date, and returns the first. The sort is total, so
  the same point always resolves to the same area on every request. `flat` areas
  rank as `Infinity` square metres, which is why they lose to every drawn zone.
- **Size** — `polygonAreaSqm()` computes the true spherical area at save time and
  stores it in `delivery_areas.area_sqm`. Sorting therefore never re-measures
  geometry at request time and never depends on box approximations.
- **Fees** — `feeForArea(area, subtotal)` returns `{ fee, baseFee, freeWaived,
  belowMinimum, remainingForMinimum, remainingForFreeDelivery }`. Order of
  precedence: minimum order first (refuse), then free-delivery threshold (fee 0),
  then the area fee.

If the tables are missing, `hasDeliverySchema()` returns `false`,
`resolveDelivery()` takes the legacy branch and returns the flat ₦1,000 with no
table label — today's behaviour, byte for byte.

---

## 3. SQL

The file is `docs/sql/3b-delivery-and-table-labels.sql`. It is additive and
idempotent: `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, a
`pg_constraint` guard for the CHECKs, and one expression index. No row is updated,
no column is dropped or renamed.

**Required** (run first): `delivery_areas`, `table_labels`, the seven nullable
`orders` columns, three nullable `businesses` columns, and indexes.

**Optional** (run second, only if you want today's pricing preserved): one flat
₦1,000 area for every business that has no area at all.

Run order, and the effect of each step, are in the chat reply that accompanies
this report.

---

## 4. Design notes (3A system, no new primitives)

- Both screens use `PageContainer`, `PageHeader`, `StatGrid`, `SplitLayout`,
  `SectionCard`, `FormField`, `TextInput`, `Toggle`, `Notice`, `EmptyState`,
  `ErrorState`, `PageSkeleton` and `ConfirmDialog` from `components/dashboard/`.
  No new colour, radius or shadow token was introduced.
- Desktop composed at 1024 / 1280 / 1440: the editor is a two-column
  `SplitLayout` (map and list on the left, prep time, pin, address tester and the
  rules on the right, 320px). Below `lg` it collapses to a single column and the
  list becomes cards.
- Mobile: every control is 44px (`h-11`, `size-11`); the map is 320–340px tall
  with `touchZoomRotate` rotation disabled so drawing does not spin the map
  mid-edit; long names truncate instead of pushing a row wide; no horizontal
  overflow at 360 or 390 (no fixed-width elements, `min-w-0` throughout the flex
  rows).
- Icons are lucide line icons only. No emoji, no gradient, no blob, no filler
  copy.
- States: skeleton while loading, `ErrorState` with a retry on failure, dashed
  `EmptyState` when there are no areas or tables, inline field errors next to the
  offending input (never a toast for a validation message), `aria-live` on the
  address-check result.
- Accessible: labelled inputs, `aria-invalid` + `aria-describedby` from
  `FormField`, `role="radiogroup"` on the area-type selector, `aria-label` on every
  icon-only button, visible focus rings from the shared tokens, colour is never
  the only signal (paused areas are labelled "Paused" *and* dashed on the map).
- The print sheet is its own stylesheet: `@page A4 portrait, 12mm`, three cards
  per row, `break-inside: avoid`, app chrome hidden with `visibility` so the sheet
  keeps its layout box, `print-color-adjust: exact` so the brand rules and the QR
  code print as designed.

---

## 5. Verification

### Automated (`npx tsx scripts/verify-batch-3b.ts`)

`46 passed, 0 failed`. The cases, matching the brief:

- no active areas → fee 0, delivery still allowed, no match
- flat: inside, far outside, ranks as the largest possible area
- radius: inside, outside, **exactly on the rim** (3 000.0 m measured against
  3 000 m + 1 m), and 10 m past the rim already outside
- polygon: inside, outside, on an edge, on a corner, hole respected,
  measured area 4.93 km² for a 2.2 km square, winding order irrelevant
- isochrone: inside, outside, on the edge
- smallest-area-wins: all containing areas enumerated in size order
  (`tight < wide < flat`), tightest decides the fee, row order does not matter, a
  point only the wide area covers falls back to it, equal sizes fall back to
  priority, paused areas ignored
- fees: charged between thresholds, ₦12,000 gap to free delivery, below minimum
  flagged with the ₦1,000 gap, exactly the minimum allowed, at the threshold the
  fee is 0 with the waived ₦1,500 still reported, no threshold means the fee
  always applies, a zero-fee area stays zero
- validation: negative fee, blank name, radius without a centre, unusable radius,
  two-point polygon, wrong geometry type, threshold below the minimum, polygon
  size measured server-side, client-supplied `area_sqm` discarded

### Type check

`npx tsc --noEmit`: **20 errors, all pre-existing on `main`** (addon-form,
addon-selection-modal, median-notification setup, drink-form, menu-item-form,
cloudinary, notification-service, payments/initialize, transactions/recheck,
share page, receipt `.toFixed`). Verified by stashing this branch and re-running
on `main`, which reports the same set. `main` reported **22** and this branch
reports **20**: the two that disappear are `TS7016` for `qrcode.react` (the
missing declaration is now provided in `types/qrcode-react.d.ts`, which the
receipt page also benefits from). No new error was introduced.

### Manual / needs your environment

- **QR preselect end to end** — needs a browser and the live storefront. The path
  was traced in code (`?table=` → sessionStorage → checkout preselection →
  server validation → order column) but not clicked through.
- **Live Mapbox calls** — geocoding, isochrone and Directions need
  `NEXT_PUBLIC_MAPBOX_TOKEN` present. Their failure branches are exercised (token
  missing → `unavailable`, no map, flat fee only), but the success response has
  not been observed from this sandbox.
- **Database checks** — the fee written onto a real order, the quote endpoint
  against real rows, and the optional backfill. All require the SQL to have run.
- **Widths** 360 / 390 / 768 / 1024 / 1440 — reviewed in code (no fixed widths,
  `min-w-0`, truncation, 44px targets) but not screenshotted; no browser is
  available here.

---

## 6. Assumptions

1. **Fee is per area, not per band.** An area has one fee. Ordering by distance
   bands is expressed as several areas (a 2 km ring and a 6 km ring), which the
   smallest-area-wins rule prices correctly without a second concept.
2. **Overlap resolution uses measured size, not the fee.** The brief said
   "smallest-matching-area-wins"; `area_sqm` is that measure. `priority` is only a
   tie-break for identical sizes, so an owner cannot accidentally invert the rule
   by setting a priority.
3. **Boundary is inclusive with a 1 m tolerance.** A pin on the rim belongs to the
   area. This is the friendliest interpretation and it is deterministic.
4. **Minimum order is a delivery constraint, not a basket constraint.** Below the
   minimum the quote reports `belowMinimum` and the order API refuses the order
   with `BELOW_MINIMUM_ORDER`; the cart is untouched.
5. **Free-delivery threshold waives the fee, it does not refund it.** The stored
   `delivery_fee` is 0 and `delivery_fee_base` logic lives in the quote response,
   so the order total and the books agree.
6. **A missing coordinate is a refusal, not a zero point.** `Number(null)` is `0`,
   so both the order API and the quote endpoint explicitly treat null/empty as
   "no pin" (and reject `0, 0`), which yields "choose your address" instead of
   "we do not deliver there".
7. **Polygon editing is native Mapbox GL, not Mapbox GL Draw.** The map editor
   captures clicks as vertices with explicit **Undo point** and **Clear**, then
   closes the ring on save. This was chosen over `@mapbox/mapbox-gl-draw` so undo
   is deterministic, no second plugin (and its CSS) is loaded on a dashboard
   screen, and touch drawing needs no modifier key. The stored geometry is
   identical GeoJSON; the point-in-area test does not know which tool drew it.
8. **Prep time lives on the business** (`prep_time_minutes`, default 20) and the
   estimate is a range: `prep + 0.85 × travel` to `prep + 1.25 × travel`, rounded
   to 5 minutes. The padding is the honest way to represent a Directions call made
   in free-flow traffic.
9. **Address search is proxied and country-restricted to `ng`** on the server, so
   the token stays off the client for that call and results cannot drift to
   another country.
10. **Admin view is read-only by construction** — the endpoint returns areas and
    labels, and there is no admin write path.

---

## 7. Not done / deliberately out of scope

- **No changes to payments, refunds, withdrawals, settlement, PIN or auth.** The
  order API's new fields sit beside the existing Paystack call; nothing in the
  money path was touched.
- **No delivery-fee refund handling.** If an order is refunded, the fee is part of
  the amount refunded as it is today; there is no separate fee reversal, and the
  brief put refunds out of bounds.
- **No rider assignment, live tracking or zone-level hours.** Not requested; would
  need its own batch.
- **No unit tests in a framework.** Verification is the script above, runnable
  with `npx tsx`, rather than a new test runner dependency.
- **`delivery_areas.area_sqm` is not backfilled for hand-written rows.** Areas
  created through the API always have it; an area inserted by hand without it
  sorts last within the same size class (it is treated as `Infinity`, same as
  flat), which is documented in `matching.ts`.
- **No screenshots.** No browser in this environment; the widths were reviewed in
  code.

---

## 8. Nothing was removed

Confirmed by `git diff --stat` against `main`: **41 files changed, 7 239
insertions, 44 deletions**. Every one of the 44 deletions is a line rewritten in
place inside a file that gained functionality, and they are all in seven files:

| File | Lines replaced | What they were |
| --- | --- | --- |
| `app/api/orders/route.ts` | 18 | the flat `DELIVERY_FEE` expression and the old fixed `INSERT INTO orders` statement (now built with the same base columns plus the additive ones) |
| `app/[slug]/checkout/page.tsx` | 12 | the `DELIVERY_FEE` import, the client-computed fee and the old address text handler (the typed address field itself is still there) |
| `app/dashboard/orders/page.tsx` | 4 | the customer line, now carrying the table badge |
| `lib/notification-service.ts` | 4 | the notification body, now carrying the table and fee |
| `lib/onboarding.ts` | 3 | two step definitions that were hard-coded `done: false` |
| `app/api/orders/[orderId]/route.ts` | 2 | the order payload, now returning the additive columns |
| `app/admin/businesses/[businessId]/page.tsx` | 1 | the import line (new icons added) |

Everything else is a pure addition: 34 files with no removed line at all,
including `app/[slug]/page.tsx`, `app/[slug]/receipt/page.tsx` and
`app/dashboard/layout.tsx`, which only gained imports, hooks and rows.

No route, component, export or database object that existed on `main` is gone.
