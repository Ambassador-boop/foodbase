# Batch 3C — kitchen display, and one paid-order alert

Docx #18 and #3. Branch `Batch-3C`, off `main` at `6bb2cdb`.

1. **A kitchen display at `/dashboard/kitchen`.** Paid orders only, three columns
   (New, Preparing, Ready), one large action per ticket, live polling, an alert sound,
   printable 80 mm tickets, and a daily strip of counts and prep time.
2. **The restaurant's "new paid order" alert now fires at payment confirmation, once.**
   It used to fire at order creation, before Paystack had confirmed anything. The
   creation-time call is gone; the function and every route remain.

---

## 1. Files changed

### New

| File | What it is |
| --- | --- |
| `app/dashboard/kitchen/page.tsx` | The screen. Server component: resolves the active business, hands off to the board. |
| `app/dashboard/kitchen/kitchen.css` | Light, dark and 80 mm print palettes; column grid; ticket and drawer layout. |
| `components/dashboard/kitchen/kitchen-board.tsx` | Polling, sound, wake lock, full screen, printing, optimistic transitions. |
| `components/dashboard/kitchen/ticket-card.tsx` | One ticket: items, add-ons, note, elapsed time, prep chips, action. |
| `components/dashboard/kitchen/recently-ready.tsx` | The recall drawer. |
| `components/dashboard/kitchen/kitchen-settings.tsx` | Per-device sheet: sound, volume, thresholds, hold time, large type, theme. |
| `components/dashboard/kitchen/kitchen-print-ticket.tsx` | The 80 mm ticket the print stylesheet reveals. |
| `components/dashboard/kitchen/paid-order-sound.tsx` | The same alert on the orders page, plus its mute control. |
| `components/dashboard/notification-settings-panel.tsx` | Device registration, test push, sound settings. |
| `app/dashboard/settings/notifications/page.tsx` | The notification settings screen. |
| `app/api/business/kitchen/orders/route.ts` | `GET` the board, with `ETag` / `?since=`. |
| `app/api/business/kitchen/orders/[orderId]/route.ts` | `PATCH` one transition, with the full allow-list. |
| `app/api/business/notifications/test/route.ts` | `GET` push status, `POST` a real test push. |
| `lib/kitchen/board.ts` | Board query, stats, signature, per-order guard read. |
| `lib/kitchen/schema.ts` | Cached `information_schema` check for the optional 3C columns. |
| `lib/kitchen/transitions.ts` | The allowed moves, shared by the API and the buttons. |
| `lib/kitchen/types.ts` | The board's data contract. |
| `lib/kitchen/sound.ts` | The alert tone, synthesised with Web Audio. |
| `lib/kitchen/device-settings.ts` | `localStorage` settings, validated on read. |
| `lib/paid-order-notification.ts` | Claim, then send, exactly once. |
| `lib/onesignal-sound.ts` | Sound payload fields behind environment variables. |
| `public/sounds/kitchen_alert.wav` | The tone as a file, for OneSignal/Median to bundle. |
| `docs/sql/3c-kitchen-notifications.sql` | The SQL below, as a runnable file. |

### Modified

| File | Change |
| --- | --- |
| `app/api/payments/verify/route.ts` | Calls `notifyRestaurantPaidOrder` after settlement. Two added lines plus a comment. |
| `app/api/payments/webhook/route.ts` | Same, on `charge.success`. |
| `app/api/orders/route.ts` | **The one allowed removal:** the creation-time `sendNewOrderNotification` call and its import. |
| `app/dashboard/layout.tsx` | `Kitchen` nav entry (ChefHat icon) after Orders. |
| `app/dashboard/orders/page.tsx` | `Kitchen display` button, the shared sound toggle, the new-paid-order alert. |
| `app/dashboard/settings/page.tsx` | One added card: "Push alerts". The existing "Notifications — Coming soon" card is untouched. |

Nothing else was touched. No file was deleted.

---

## 2. The SQL you run, before merging

`docs/sql/3c-kitchen-notifications.sql`. Additive, idempotent, one transaction.
**The code works without it** (see §5).

```sql
BEGIN;

-- REQUIRED. The claim marker for "the restaurant has been told this order is paid".
ALTER TABLE orders ADD COLUMN IF NOT EXISTS restaurant_notified_at timestamptz;

COMMENT ON COLUMN orders.restaurant_notified_at IS
  'When the restaurant was told this order is paid. NULL = not announced. Claimed by a single guarded UPDATE.';

-- The board's read: business + one of three statuses, paid only.
CREATE INDEX IF NOT EXISTS orders_kitchen_board_idx
  ON orders (business_id, status)
  WHERE payment_status IN ('paid', 'completed');

-- OPTIONAL. The prep estimate a cook picks on the ticket.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kitchen_prep_minutes integer;

-- OPTIONAL. When the pass marked it ready, for a true "average to ready".
ALTER TABLE orders ADD COLUMN IF NOT EXISTS kitchen_ready_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_kitchen_prep_minutes_range'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_kitchen_prep_minutes_range
      CHECK (kitchen_prep_minutes IS NULL OR (kitchen_prep_minutes >= 1 AND kitchen_prep_minutes <= 240));
  END IF;
END $$;

-- OPTIONAL but recommended: seal history so a late webhook replay cannot
-- announce last week's meal as a new paid order.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'paid_at'
  ) THEN
    UPDATE orders SET restaurant_notified_at = COALESCE(paid_at, updated_at, created_at)
     WHERE restaurant_notified_at IS NULL AND payment_status IN ('paid', 'completed');
  ELSE
    UPDATE orders SET restaurant_notified_at = COALESCE(updated_at, created_at)
     WHERE restaurant_notified_at IS NULL AND payment_status IN ('paid', 'completed');
  END IF;
END $$;

COMMIT;
```

Verify afterwards (read-only):

```sql
SELECT column_name, data_type, is_nullable FROM information_schema.columns
 WHERE table_name = 'orders'
   AND column_name IN ('restaurant_notified_at','kitchen_prep_minutes','kitchen_ready_at')
 ORDER BY column_name;

SELECT indexname FROM pg_indexes
 WHERE tablename = 'orders' AND indexname = 'orders_kitchen_board_idx';

-- expect 0
SELECT count(*) FROM orders
 WHERE payment_status IN ('paid','completed') AND restaurant_notified_at IS NULL;
```

Rollback (only if 3C is reverted): drop the index, the constraint and the three
columns. Nothing else in the codebase reads them.

---

## 3. Audit findings: who is told what, and when

Read from `lib/notification-service.ts`, `lib/median-bridge.ts`, `app/api/save-push-token`,
`app/api/notifications/*`, `app/api/orders/notify`, `app/api/orders/[orderId]/status`
and their callers. Every restaurant notification is a OneSignal push to devices
carrying the `business_id` tag, plus a row in `notifications`.
**No path notifies the customer.** There is no customer-facing status notification in
this codebase.

| # | Trigger | Code path | Who receives | When | Message |
| --- | --- | --- | --- | --- | --- |
| 1 | Order created | `app/api/orders/route.ts` → `sendNewOrderNotification` | Owner devices | **Before payment** | "New Order from X" + item summary |
| 2 | Payment settled | `payments/verify` + `payments/webhook` → `sendOrderStatusNotification` | Owner devices | At payment | "Order Status Update" · "Order #x - Confirmed - paid" |
| 3 | Manual status change | `PATCH /api/orders/[orderId]/status` → self-fetch `/api/notifications/send-order` | Owner devices | Every status change | "New Order from X" — the wrong title for a status change |
| 4 | Manual resend | `POST /api/orders/notify?orderId=…` | Owner devices | On demand | Manual / reminder / status |
| 5 | Unused route | `app/api/notifications/update-order-status` | Owner devices | Never called by the app | Order status update |
| 6 | Device registration | `save-push-token` ← `initializeOneSignalFlow` (Median) | nobody | On app open in Median | **Logs only.** No `device_tokens` table; the token is not persisted |

What that means:

- **#1 fired for unpaid orders.** Abandoned checkouts alerted the kitchen. Fixed by §4.
- **#2 was already close to once.** `fb_settle_payment` returns `settled` to one caller
  only; the second sees `already_settled` and skips. The new paid alert keeps that
  property and adds a durable one.
- **#3 has two pre-existing problems, both left alone:** the title says "New Order" for
  a status change, and the body prices items with `$` rather than `₦`. Neither is a 3C
  change; both need your say-so.
- **#6 is the honest answer to "is this device registered".** Today the answer lives only
  in OneSignal, not in your database. The settings screen therefore reports the browser's
  own truth (permission plus subscription id) and fires a real test down the same path,
  instead of inventing a registration table.
- **The OneSignal base URL is the legacy one** (`https://onesignal.com/api/v1/notifications`).
  It still works, but legacy keys can no longer be minted. Migrating to
  `https://api.onesignal.com/notifications?c=push` is a separate, riskier change.

---

## 4. The paid-order alert, exactly once

`lib/paid-order-notification.ts`, called from `payments/verify` (on `settled` **and**
`already_settled`, so a failure repairs itself on the next look) and from
`payments/webhook` (`charge.success`, same two statuses).

The claim is one statement, because the Neon HTTP driver cannot hold a transaction:

```sql
UPDATE orders SET restaurant_notified_at = NOW()
 WHERE id = $1
   AND restaurant_notified_at IS NULL
   AND payment_status IN ('paid', 'completed')
RETURNING id;
```

A caller that gets a row back sends the push. A caller that gets nothing stays silent.
Verify and the webhook can race; only one wins the row.

Message: `Paid order · Table 4` / `#A1B2C3D4 · ₦12,400.00 · 4 items · Table 4`.
Short id, total, item count (sum of quantities) and the table label when the Batch 3B
column exists.

If the send fails the claim is released (`restaurant_notified_at = NULL`) so the next
attempt can deliver. If OneSignal is not configured the order is **not** claimed.

**Without the SQL:** the claim is a row inserted into `notifications` with the
deterministic value `paid-claim:<orderId>`, relying on that table's existing
`UNIQUE (onesignal_notification_id)`. Same exactly-once behaviour, no schema change.

### The one removal

`app/api/orders/route.ts` no longer imports or calls `sendNewOrderNotification`.
`sendNewOrderNotification` is intact and still exported from `lib/notification-service.ts`;
`/api/orders/notify` and every other notification route are untouched. Verified:
`grep -rn sendNewOrderNotification` returns only the definition.

---

## 5. What the kitchen display does

**Board.** Three columns, landscape. A ticket appears only if
`payment_status IN ('paid','completed')` — the shared definition imported from
`lib/admin-analytics.ts` (`PAID_ORDER_CONDITION`), the same condition `fb_settle_payment`
checks. Completed, cancelled and out-for-delivery orders are excluded by the query,
rejected by the API, never rendered.

**Ticket.** Short id, table chip, delivery / dine-in / pickup badge, quantities, add-ons
from `order_items.configuration`, the customer note in a bordered block above the items,
elapsed time since payment, the prep estimate when set, one large action (48px). New
tickets also offer 10 / 15 / 20 / 30 minute estimate chips.

**Escalation, without red or green.** Three per-device thresholds (defaults 10 / 18 / 28
minutes): the left rule grows 3 → 4 → 6 → 8px, the timer gains weight and moves from
ink-3 to ink-2 to accent, the card background deepens once, and a written flag changes:
*On time · Watch · Over target · Well over*. Colour is never the only signal.

**Transitions.** `PATCH /api/business/kitchen/orders/[orderId]` with
`{ to: 'preparing' | 'ready', prepMinutes? }`. Permitted: `pending → preparing`,
`preparing → ready`, `ready → preparing`. Rejected before anything is written: unpaid
(`409 unpaid`), completed / cancelled / out_for_delivery (`409 final_state`), any other
target including `completed` and `out_for_delivery` (`409 illegal_transition`), another
business's order (`404`), no session (`401`). The write itself is delegated to the
existing `PATCH /api/orders/[orderId]/status` handler, imported and called in-process
with the caller's own cookie, so the existing status side effects run exactly as they do
from the orders page. No notification logic was copied.

**Live updates.** 5 s poll, `If-None-Match` with the server's ETag; an empty poll is one
aggregate query and a `304` with no body. The poll stops on `visibilitychange` hidden and
returns with a forced refresh. The connection indicator reads `Live · every 5s`,
`Paused while hidden`, `Reconnecting` or `Offline · retrying`, and failures keep the last
board on screen while retrying.

**Sound.** Web Audio, a rising major triad (A5, C#6, E6) with a bell envelope — no
downloaded asset, no licence. The first run shows an "Enable sound" gate that primes the
audio context on a real tap and plays a test. Mute and volume sit in the top bar and in
Settings. The alert repeats every 30 s while any New ticket is untouched, with a
"Stop alerts" bar visible for as long as that is happening; the next real arrival re-arms
it. A reload during service rings only for a ticket paid in the last 60 seconds.

**Extras.** Wake lock (re-acquired on return), full-screen toggle, large type, light /
dark / auto appearance, printable 80 mm ticket per order, "Recently ready" drawer with
recall, and the daily strip: paid today, reached the pass, average to ready, oldest open
ticket, open tickets.

**Responsive.** At 1024 and 1280 landscape the three columns share the width and each
scrolls inside its own frame (the shell is `calc(100dvh - 3rem)`, the dashboard's own
padding). Below 900px the columns stack, the page scrolls normally and inner scroll areas
are switched off — nested scrolling on a phone is a trap. At 390 the header wraps to two
rows, the ticket keeps its 48px action, and no horizontal scroll is introduced.

---

## 6. Manual steps: sounds on native pushes

Two facts decide this, both from primary docs:

- **No custom sound on web push.** OneSignal: *"For mobile apps only. Custom sounds are
  not supported on web push."* A browser tab always uses the system sound. The
  in-dashboard Web Audio tone is the only sound available there.
- **On Android the sound belongs to the notification channel, not the message.**
  `android_sound` is documented as not working on Android 8+, and is absent from the
  current API reference. The repo therefore sends `android_channel_id` and `ios_sound`,
  and nothing else.

### A. OneSignal dashboard

1. **Settings → Push & In-App → Android Notification Channels → Add Group** (`Orders`)
   → **Add Channel**.
2. Channel fields: Name `Order alerts`, **Importance `Urgent`** (sound *and* a heads-up
   banner; `High` plays a sound but no banner), **Sound `Custom`** → the name Median
   assigned, **without extension** (e.g. `custom_sound_1`), Vibration `Default`,
   Badges `Enabled`, Lockscreen visibility `Public`. Save.
3. Copy the **Channel ID** (a UUID) → Vercel env `ONESIGNAL_ANDROID_CHANNEL_ID`, unprefixed
   (OneSignal adds `OS_` itself).
4. iOS needs nothing in the dashboard: the sound is a message field, not a category.
5. Optional iOS env: `ONESIGNAL_IOS_INTERRUPTION_LEVEL=active`,
   `ONESIGNAL_IOS_BADGE_TYPE=Increase`, `ONESIGNAL_IOS_BADGE_COUNT=1`.

Trap: **Android locks a channel's sound after the first delivery.** Editing it later
changes nothing on devices that already received it. Create a new channel, update the
env var.

### B. Median app (median.co)

1. Median → **App Studio** → your app → **Native Plugins → OneSignal** → confirm the
   plugin is enabled and the App ID is set.
2. Same plugin → **Settings** → **upload the sound**. Median converts formats itself and
   names files in upload order: `custom_sound_1`, `custom_sound_2`, …
3. iOS plays `custom_sound_1.caf` (extension required in the payload); Android refers to
   the same file as `custom_sound_1` (no extension).
4. **Build a new binary and ship it.** The sound is compiled in at build time; an
   already-installed build does not have it and falls back to the system tone.

### C. Environment variables in the repo

| Variable | Example | Sent as | Platform |
| --- | --- | --- | --- |
| `ONESIGNAL_ANDROID_CHANNEL_ID` | `1a2b3c4d-…` | `android_channel_id` | Android — the only Android sound control |
| `ONESIGNAL_IOS_SOUND` | `custom_sound_1.caf` | `ios_sound` | iOS — extension required |
| `ONESIGNAL_IOS_INTERRUPTION_LEVEL` | `active` | `ios_interruption_level` | iOS |
| `ONESIGNAL_IOS_BADGE_TYPE` / `_COUNT` | `Increase` / `1` | `ios_badgeType` / `ios_badgeCount` | iOS |

All optional. Unset, the payload is byte-for-byte what it is today. Nothing throws, and
`lib/onesignal-sound.ts` ignores values it does not recognise.

`public/sounds/kitchen_alert.wav` (1.0 s, 44.1 kHz mono, lowercase, under iOS's
30-second limit) is the file to upload to Median in step B2.

### D. What is impossible, and why

- Custom sound on web push: not supported, by anyone. System sound only.
- A different sound per business in one API call: sound fields are request-level. That
  needs one request per variant; the `business_id` tag filter already supports the shape.
- Changing a channel's sound after delivery: Android will not. New channel, new env value.
- Bypassing Do Not Disturb: OneSignal does not set `setBypassDnd`. Only
  `ios_interruption_level: critical` (Apple approval) breaks through on iOS.
- iOS web push outside Median needs iOS 16.4+, Home Screen installation, a manifest with
  `display: standalone`, and the prompt inside a user gesture — and still gives the
  system sound only.

---

## 7. Assumptions

1. **"Paid" is `payment_status IN ('paid','completed')`**, imported from
   `PAID_ORDER_CONDITION` rather than restated.
2. **`orders.paid_at` exists** on the live database (settlement writes it, admin analytics
   reads it). If it does not, elapsed time falls back to `updated_at`.
3. **Fulfilment is inferred:** `table_label` → dine-in; a delivery area or address →
   delivery; otherwise pickup.
4. **The "customer status notification" in the brief does not exist in this codebase.**
   The only status-update side effect is the owner-facing one. Item (a)3 was followed
   literally: the existing handler is called, not reimplemented. Consequence in §8.
5. **The kitchen writes through the existing status endpoint**, so each start / ready /
   recall fires the existing owner status push. That is the existing behaviour of every
   status change and was not changed.
6. **A ready ticket stays on the pass for the device's hold time** (default 20 min) before
   moving to Recently ready, where recall still works. Without `kitchen_ready_at` the age
   is measured from when this device first saw the ticket.
7. **Item count is the sum of quantities**, add-ons excluded — the number a cook counts.
8. **Orders at status `confirmed` do not appear.** The board shows pending / preparing /
   ready only, as specified. Nothing in this codebase moves an order to `confirmed`.
9. **Sound is per device**, in `localStorage`, shared by the kitchen board and the orders
   page. Not a restaurant-wide setting.
10. **`notifications` rows are the dashboard's history**, so every alert also writes one
    there, as the existing senders do.

---

## 8. Not done, and why

- **The owner still gets two pushes at payment:** the existing "Order Status Update ·
  Confirmed · paid", and the new paid-order alert. Removing the first is not the permitted
  removal and it is a status notification, so it stays. Recommended follow-up, with your
  approval.
- **The status-change push says "New Order from X".** Every kitchen transition now
  triggers it, because the kitchen deliberately reuses the existing path. Fixing the title
  changes a shared notification used by the orders page; it needs your say.
- **Existing notification copy prices items in `$`, not `₦`** (`formatOrderItems` in
  `lib/notification-service.ts` and `app/api/notifications/send-order/route.ts`).
  Pre-existing, untouched.
- **OneSignal is still on the legacy base URL.** Works today; migrating to
  `api.onesignal.com` with a v2 key is a separate change.
- **No customer-facing notification was added.** Out of scope, and it does not exist today.
- **`save-push-token` still does not persist a device.** The settings screen reports
  browser truth rather than inventing a table.
- **No SQL was executed**, by rule. There is no live database here, so transitions were
  verified by unit test and by construction, not against real rows.
- **No screenshot pass at 1024 / 1280 / 390.** Layout was verified by reading the CSS and
  by a clean production build; it has not been eyeballed on a device.

---

## 9. Verification performed

| Check | Result |
| --- | --- |
| `npx tsc --noEmit` | 20 errors, **all pre-existing** (identical count on a clean `main` worktree). None in a 3C file. |
| `npx next build` | Compiled successfully. `/dashboard/kitchen`, `/dashboard/settings/notifications`, `/api/business/kitchen/orders`, `/api/business/kitchen/orders/[orderId]`, `/api/business/notifications/test` all in the route table. |
| Allowed transitions | `pending → preparing`, `preparing → ready`, `ready → preparing` — pass. |
| Rejected transitions | `new → ready`, `preparing → new`, `ready → ready`, `preparing → preparing` — rejected. `completed`, `cancelled`, `out_for_delivery` (any case) map to no stage and are final; the API returns `final_state` before any write. |
| Unpaid order | `payment_status` check runs before the write; `409 unpaid`. |
| Other business | Guard read is scoped by `business_id`; `404 not_found`. |
| Polling pauses when hidden | `visibilitychange` clears the interval and sets `Paused while hidden`; return forces an immediate refresh. |
| One notification per paid order | Single guarded `UPDATE … WHERE restaurant_notified_at IS NULL … RETURNING`; the loser gets no row and sends nothing. Both call sites attempt it, so a failed send repairs itself. |
| Only one removal | The diff touches three payment/order files: two add a call, one removes the creation-time call. `grep -rn sendNewOrderNotification` returns only the definition. |

A 22-assertion unit test of `lib/kitchen/transitions.ts` was run against the compiled
module; all 22 passed.
