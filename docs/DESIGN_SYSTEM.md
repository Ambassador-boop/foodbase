# Dashboard design system

Batch 3A. The system the restaurant dashboard is meant to grow into. It was written
for three new screens (`/register/restaurant`, `/dashboard/onboarding`, `/dashboard/hours`)
and for the admin registrations list, and it is deliberately **additive**: no existing
dashboard page was restyled, and nothing here changes how an existing screen behaves.

Everything lives in `components/dashboard/`. Import from the barrel:

```tsx
import { PageHeader, SectionCard, StatTile, DataTable } from '@/components/dashboard'
```

---

## 1. Principles

1. **Editorial, not decorative.** Hierarchy comes from type scale, measure and rules,
   not from cards inside cards, gradients or drop shadows. If a screen works with the
   shadows turned off, the layout is doing its job.
2. **Numbers are data.** Money, counts and times use tabular numerals (`dash-num`) and
   are right-aligned in tables. `₦12,400.00` never wiggles between rows.
3. **Density with air.** 4px and 8px steps only. A dashboard for an operator is read in
   glances during service; compact is kinder than airy.
4. **States are designed.** Every list has an empty state with a next action, every
   fetch has a skeleton, every failure has a message that says what to do. "No data" is
   never acceptable copy.
5. **Nothing is announced that is not true.** No "Welcome back!", no "Seamless", no
   exclamation marks. Sentence case, specific nouns, real numbers.
6. **Accessible by construction.** AA contrast, visible focus, 44px touch targets,
   labelled controls, `aria-live` on async status.

---

## 2. Tokens

All colour, spacing and motion tokens are CSS variables declared once in
`app/globals.css` under **"Dashboard design system tokens (Batch 3A, additive)"**.
Existing tokens were not modified.

### Surfaces and lines

| Token | Value | Use |
| --- | --- | --- |
| `--dash-cream` | `#FBF4EE` | Page background behind content |
| `--dash-surface` | `#FFFFFF` | Card and table surfaces |
| `--dash-surface-sunken` | `#FBF8F4` | Empty states, inset blocks |
| `--dash-surface-inset` | `#F7F0E8` | Tracks, disabled fills, prefix chips |
| `--dash-line` | `#E9DCD0` | Default 1px rule |
| `--dash-line-strong` | `#D9C7B7` | Input borders, primary dividers |

### Ink

`--dash-ink-1` (`#1D1A17`) headings and primary values · `--dash-ink-2` (`#453D36`) body ·
`--dash-ink-3` (`#6B5D52`) secondary body · `--dash-ink-4` (`#8B7D71`) labels, captions,
placeholders. On white, ink-3 and ink-4 both clear AA for text at 12px and above.

### Brand and status

`--dash-brown` `#8E3800` (primary action, active state) · `--dash-brown-deep` `#6F2C00`
(hover) · `--dash-brown-soft` `#A85C2B` (rare accents) · `--dash-sand` / `--dash-sand-deep`
(quiet brand fills).

Status pairs are always a text colour plus a matching background: `--dash-success`
`#1F7A47` on `--dash-success-bg`, `--dash-warning` `#8A5A12` on `--dash-warning-bg`,
`--dash-danger` `#B23A3A` on `--dash-danger-bg`, `--dash-info` `#1F5F8B` on
`--dash-info-bg`. Never put status text directly on white at 11px; use a pill.

### Motion and geometry

`--dash-motion-fast: 150ms`, `--dash-motion-base: 180ms`, `--dash-ease: cubic-bezier(.2,.7,.3,1)`.
Radii: `6px` controls, `8px` cards and inputs, `10px` page-level panels, `999px` pills.
Shadows are used twice only: `--dash-shadow-1` for a resting segmented control,
`--dash-shadow-pop` for dialogs and menus.

### Utility classes

| Class | What it does |
| --- | --- |
| `dash-surface` | Applies the editorial type pairing and AA focus ring to a subtree. **Every new screen root uses it.** |
| `dash-display` | Display face (Instrument Serif) with tight tracking. Page titles only. |
| `dash-num` | `font-variant-numeric: tabular-nums`, slightly tighter tracking. Money, counts, times, IDs. |
| `dash-tap` | Guarantees a 44px hit area on touch without changing visual size. |
| `dash-rule` | Hairline horizontal rule matching `--dash-line`. |
| `dash-safe-bottom` / `dash-safe-top` | `env(safe-area-inset-*)` padding for iOS. Use on sticky footers and page bottoms. |
| `dash-rise` | 180ms fade-and-rise for content that appears after a load. Suppressed under `prefers-reduced-motion`. |

### Typography

Two faces, both loaded with `next/font`:

- **Instrument Serif** (`dash-display`) for page titles and the registration headline.
- **Instrument Sans** for everything else inside `dash-surface`.

Sizes are set in `px` for predictability: 32–46 display, 20–24 section title,
14–15 strong body, 13 body, 12–12.5 secondary, 11–11.5 labels and captions, 10.5 legal.
Never go below 10.5px. Measure cap: `max-w-[64ch]` for prose, `52ch` for side panels.

---

## 3. Layout helpers

```tsx
<DashSurface>                       {/* type pairing + focus ring */}
  <PageContainer width="default">    {/* 1320 / wide 1400 / narrow 720 */}
    <PageHeader
      eyebrow="Setup"                {/* optional, a section name never a greeting */}
      title="Finish setting up Mama Nkechi's Kitchen"
      description="…"
      meta={<>18 orders today</>}     {/* hairline-separated facts */}
      actions={<button>View storefront</button>}
      backHref="/dashboard"
      backLabel="Dashboard"
    />
    <SplitLayout main={<…/>} side={<…/>} sideWidth={320} />
  </PageContainer>
</DashSurface>
```

- `PageHeader` renders an `h1`; a page must have exactly one.
- `SectionCard` is the standard content block. `padding="none"` for tables and lists,
  `"tight"` for side panels, `"default"` otherwise.
- `SplitLayout` gives a two-column layout above `lg` and stacks below. The side column is
  for context, never for the primary action.
- `Stack` (`gap`), `Row` (`gap`, `align`, `justify`), `Rule`, `InsetPanel` and
  `StatGrid` handle the remaining composition so screens do not invent flex wrappers.
- `KeyValueList` renders `label: value` pairs with optional `hint`; use it in side panels
  instead of a loose `<dl>`.

---

## 4. Components

### StatTile

```tsx
<StatTile
  label="Net revenue"
  value={money(124000)}
  hint="This month, settled"
  delta={{ value: 12.4, goodDirection: 'up' }}
  tone="success"
  emphasis
  href="/dashboard/finance"
/>
```

`value` is a node so callers pass `money()` or `count()`. `emphasis` gives the tile a
sand background and larger figure: use it for the one number the screen is about, never
for all of them. `tone` tints the figure only.

### StatusPill / StatusBadge / Counter

```tsx
<StatusPill tone="success">Active</StatusPill>
<StatusBadge status="pending" />              {/* maps the domain value through statusTone() */}
<StatusBadge status="cancelled" label="Refunded" />
<Counter value={3} label="unread" />
```

Six tones only: `neutral | brand | success | warning | danger | info`. Map domain values
with `statusTone()` rather than deciding per screen; `StatusBadge` does exactly that from
a raw status string. A pill is a status, not a button.

### DataTable

```tsx
<DataTable
  rows={rows}
  columns={columns}
  getRowKey={(row) => row.id}
  getRowHref={(row) => `/admin/businesses/${row.id}`}
  caption="Restaurants that registered themselves, newest first"
  initialSort={{ key: 'created_at', direction: 'desc' }}
  pageSize={25}
  loading={loading}
  empty={<EmptyState … />}
  renderMobile={(row) => <RegistrationCard row={row} />}
/>
```

Column shape:

```tsx
{ key, header, render, sortValue?, align?, numeric?, hideBelow?, width? }
```

- **Sticky header** (`sticky` default) with a hairline border and the sand background.
- **Sortable** when `sortValue` is provided. Clicking cycles ascending → descending.
- **Mobile card fallback**: below `sm` the table is replaced by `renderMobile`. If you
  omit it, the table degrades to first-column plus label/value pairs, so always supply
  one for anything with actions.
- `hideBelow: 'sm' | 'lg'` drops secondary columns before the layout gets cramped.
- `numeric` right-aligns and applies `dash-num`.
- `empty` is required. A table without a caption is not accessible, so `caption` is too.

### EmptyState / ErrorState / Notice / Skeleton

```tsx
<EmptyState
  icon={Store}
  title="No self-registrations yet"
  description="When a restaurant registers from the public page it appears here immediately."
  action={<Link href="/register/restaurant">Open the form</Link>}
  secondaryAction={<button>Refresh</button>}
/>

<ErrorState description="…" onRetry={reload} />
<Notice tone="warning" title="Hours not set">…</Notice>
<Skeleton className="h-80 w-full" />
```

Copy rules: empty state names the object and the next action. Error state says what failed
in plain words and offers retry. `PageSkeleton` and `TableSkeleton` exist for first loads.

### FormField, TextField, PasswordField, SelectField, CheckboxField

```tsx
<TextField
  label="Mobile number"
  type="tel"
  required
  value={phone}
  onChange={set('phone')}
  onBlur={normalise}
  error={errors.phone}
  hint="A Nigerian number, for example 0803 123 4567."
  placeholder="0803 123 4567"
/>

<FormField label="Storefront address" htmlFor="slug" required error={e} hint={hint}>
  {(meta) => <input id={meta.id} aria-describedby={meta['aria-describedby']} … />}
</FormField>
```

- Inputs are `h-11` (44px), radius 8px, `--dash-line-strong` border, brown focus border.
- `error` replaces the hint and sets `aria-invalid`; hints are wired through
  `aria-describedby` automatically. Never rely on colour alone: the message is text.
- `FormField` is the escape hatch for composite controls (the slug field with its
  `foodbase.ng/` prefix). It supplies `id`, `aria-describedby` and error rendering.
- `PasswordField` includes a show/hide control. Strength meters are the caller's job
  (`scorePassword` in `lib/registration/validation.ts`).
- `CheckboxField` takes a node `label` (links), an optional `description` and an `error`.
- `CheckmarkList` is for reassurance points under a submit button.

Validation appears on blur and on submit, never on the first keystroke.

### Stepper / ProgressLine

```tsx
<Stepper
  steps={[{ key: 'days', label: 'Days open' }, { key: 'times', label: 'Opening times' }]}
  current={1}
  onSelect={(index) => scrollTo(index)}
/>
<ProgressLine value={60} label="Setup" tone="brand" />
```

Use `Stepper` for a sequence with real stages (or as a section navigator on a long form,
as `/dashboard/hours` does). It is not decoration; if the stages do not exist, use
`ProgressLine`.

### ChecklistItem

```tsx
<ChecklistItem
  index={1}
  title="Set your withdrawal PIN"
  why="The six-digit PIN is what stops someone with your password from moving money."
  minutes={2}
  status="todo"            // done | todo | skipped | locked
  href="/dashboard/security"
  onSkip={…}               // omit for critical or locked steps
  lockedReason="Table labels arrive with the dine-in tools."
/>
```

`done` gets a check, `skipped` a dashed marker, `locked` a lock with its reason and no
link. Never render a locked step as an error.

### Toggle / TimeInput

```tsx
<Toggle id="accept-outside" checked={on} onChange={setOn} label="Keep accepting orders when we are closed" description="On by default." />
<TimeInput id="open-1" label="Opens" value={open} onChange={setOpen} />
```

`Toggle` is a real `role="switch"` with `aria-checked` and a 44px target. `TimeInput`
uses the native time picker (mobile-native, keyboard accessible) with 15-minute steps.

### Toast and ConfirmDialog

```tsx
toast.success('Opening hours saved', { description: 'Your storefront now shows open or closed.' })
toast.error('Could not save', { description: 'Check your connection and try again.' })

<ConfirmDialog
  open={Boolean(target)}
  onOpenChange={(open) => !open && setTarget(null)}
  title="Suspend Mama Nkechi's Kitchen?"
  description="Customers will see a closed storefront…"
  confirmLabel="Suspend restaurant"
  tone="danger"
  loading={saving}
  onConfirm={() => changeStatus(target, false)}
/>
```

The toaster is mounted once in `app/layout.tsx`; do not mount another. Toasts confirm,
they do not explain. Anything with a consequence (suspend, refund, delete, withdrawal)
goes through `ConfirmDialog` and the confirm label repeats the verb.

### MapContainer

```tsx
<MapContainer label="Delivery area map" address={business.address} hint="Pins are added when delivery areas ship." />
```

A named region with a placeholder slot for a map. It intentionally renders a labelled
grid rather than a fake map: no invented geography. Pass a provider component as
`children` when one exists.

### Formatting helpers

`money()` (kitchen table format `₦12,400.00`), `count()`, `percent()`, `dateTime()`,
`relativeTime()`, `formatNigerianPhone()`, `statusTone()`. Use them instead of
`toLocaleString()` inline so the whole product formats money the same way.

---

## 5. Page patterns

**List page** → `PageHeader` with counts in `meta` → a three-tile `StatGrid` when the
counts are the point → `SectionCard` with a `SearchInput` + `FilterTabs` toolbar →
`DataTable`. Actions live in the last column and never inside the row link.

**Form page** → `PageContainer width="narrow"` (720px) → `PageHeader` → `SectionCard`
per logical group with the submit either at the end (`h-11` primary) or in a sticky
footer (`dash-safe-bottom`) when the form is long. Errors appear above the fields and
focus moves to the summary.

**Guided setup** → `PageHeader` → `SplitLayout`: checklist in main, "what is saved" and
"why this order" in the side column. Progress is measured only against steps that can be
finished today.

**Empty and error** → always inside the `SectionCard` that owns the data, never as a
whole-page takeover unless the page cannot function at all.

---

## 6. Accessibility contract

- Contrast: ink-1/2/3 and every status pair meet AA at their used size. Do not invent
  lighter greys; use `--dash-ink-4` and stop.
- Focus: `dash-surface` sets a 2px brown `:focus-visible` ring. Interactive components
  carry `dash-tap` for a 44px target. Never remove an outline without replacing it.
- Every input has a `<label for>`. Required fields carry `required` plus `aria-required`.
- Async status is announced: slug availability uses `aria-live="polite"`, form errors use
  `role="alert"` and move focus to the summary.
- Tables: `<caption>` from the `caption` prop, `scope="col"` headers, `aria-sort` on the
  sorted column.
- Motion: 150–180ms, transform/opacity only, all suppressed under
  `prefers-reduced-motion: reduce` (declared in `globals.css`).
- Icon-only buttons need `aria-label`. Icons are `lucide-react` line icons only; no emoji.

---

## 7. Responsive rules

Breakpoints follow Tailwind defaults, designed at **360 / 390 / 768 / 1024 / 1280 / 1440**.

- No horizontal scrolling at 360px. Test with a long restaurant name and a `₦` figure.
- Grids use `minmax(0,1fr)` and children get `min-w-0`; truncate with `truncate`, never
  with a fixed width.
- Side columns collapse below `lg`; the main column always comes first in DOM order
  except on the public registration page, where the photograph leads on mobile.
- Sticky footers add `dash-safe-bottom`. Sticky table headers stay inside the card.
- Touch targets are ≥44px including table actions (use `h-9` + `dash-tap` at minimum).

---

## 8. Adopting the system on an existing page

1. Do **not** change a page you were not asked to change. This batch only restyles the
   new screens.
2. When a page is rescheduled for migration: wrap the root in `DashSurface`, swap local
   cards for `SectionCard`, local tables for `DataTable`, local empty states for
   `EmptyState`, and leave the data fetching and behaviour alone.
3. Keep the old page's URLs, query parameters and mutation endpoints identical. The
   design system is presentation only.

---

## 9. File map

| File | Contents |
| --- | --- |
| `components/dashboard/layout.tsx` | `DashSurface`, `PageContainer`, `PageHeader`, `SectionCard`, `InsetPanel`, `Stack`, `Row`, `SplitLayout`, `StatGrid`, `Rule`, `KeyValueList` |
| `components/dashboard/tokens.ts` | Tones and formatters (`money`, `count`, `percent`, `dateTime`, `relativeTime`, `formatNigerianPhone`, `statusTone`) |
| `components/dashboard/stat-tile.tsx` | `StatTile`, `StatBar` |
| `components/dashboard/status-pill.tsx` | `StatusPill`, `StatusBadge`, `Counter` |
| `components/dashboard/data-table.tsx` | `DataTable`, `SearchInput`, `FilterTabs` |
| `components/dashboard/empty-state.tsx` | `EmptyState`, `ErrorState`, `Notice`, `Skeleton`, `PageSkeleton`, `TableSkeleton` |
| `components/dashboard/form-field.tsx` | `FormField`, `TextField`, `TextArea`, `SelectField`, `PasswordField`, `CheckboxField`, `CheckmarkList` |
| `components/dashboard/stepper.tsx` | `Stepper`, `ProgressLine` |
| `components/dashboard/checklist-item.tsx` | `ChecklistItem` |
| `components/dashboard/toggle.tsx` | `Toggle`, `TimeInput` |
| `components/dashboard/toast.tsx` | `toast`, `ToastRegion` |
| `components/dashboard/confirm-dialog.tsx` | `ConfirmDialog` |
| `components/dashboard/map-container.tsx` | `MapContainer` |
| `components/dashboard/index.ts` | The barrel: import from here |
