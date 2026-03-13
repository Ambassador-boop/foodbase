# Issues Found & Resolved

## Issue 1: Add-on Page Shows ₦NaN for Price

**Root Cause:**
- The `calculateAddonsPrice()` function wasn't ensuring numeric types, potentially returning undefined or non-numeric values
- When calculating `pricePerUnit` and `totalPrice`, missing explicit type conversion to numbers
- Addon prices from sessionStorage might be stored as strings

**Resolution:**
- Added `Number()` conversion in `calculateAddonsPrice()` ensuring return is always numeric
- Ensured all price calculations explicitly convert: `Number(itemPrice) + Number(addonsPrice)`
- When storing addons to cart, explicitly convert: `price: Number(a.price)`

**Files Modified:** `/app/[slug]/add-on/page.tsx`

---

## Issue 2: Cart Not Passing Amount to Checkout (₦NaN in Checkout)

**Root Cause:**
- In checkout page, `item.price` and `addon.price` weren't being converted to numbers before calculations
- Subtotal calculation was using potentially string values from sessionStorage
- Service fee calculation used integer rounding instead of proper decimal handling

**Resolution:**
- Changed to: `const itemPrice = Number(item.price) || 0;`
- Fixed addons: `(Number(addon.price) || 0)` in reduce function
- Fixed service fee rounding: `Math.round(subtotal * 0.075 * 100) / 100`
- Fixed total rounding: `Math.round((subtotal + deliveryFee + serviceFee) * 100) / 100`

**Files Modified:** `/app/[slug]/checkout/page.tsx`

---

## Issue 3: Receipt Page API 400 Error (Critical)

**Root Cause:**
- **Next.js 16 Breaking Change:** Route params are now async (Promise-based)
- API was accessing `params.orderId` synchronously, causing 400 error
- Type signature wasn't updated to match new async params

**Resolution:**
1. Changed params type to: `{ params: Promise<{ orderId: string }> }`
2. Added: `const resolvedParams = await params;` 
3. Updated param access to: `resolvedParams.orderId`
4. Imported and used `query()` function instead of `db.query()`

**Files Modified:** `/app/api/orders/[orderId]/route.ts`

**Why This Happened:**
Next.js 16 made route parameters async to improve performance. This is a framework-level change that affected all dynamic route handlers.

---

## Database Schema (Verified from Neon)

The `order_items` table structure supports addon storage correctly:
- `configuration` field (JSONB) stores addon array with: id, name, price, image_url
- `item_price` field stores the calculated price per unit
- `quantity` tracks menu item quantity (not individual addon quantity)

---

## How the System Works

1. **Add-on Selection:** User increases menu item quantity (affects how many items added to cart), then selects addons
2. **Cart Storage:** Addons stored in sessionStorage as array with id, name, price, image_url
3. **Checkout Calculation:** Subtotal = (item_price + addons_total) × quantity per item
4. **Order Storage:** order_items.configuration stores addon array as JSONB for retrieval
5. **Receipt Display:** API reconstructs addon details from order_items.configuration JSONB

---

## All Fixes Summary

| Issue | Cause | Fix | Impact |
|-------|-------|-----|--------|
| Add-on NaN | Missing type conversion | Added Number() conversions | Prices now display correctly |
| Checkout NaN | String prices in calculations | Explicit Number() in checkout | Amount passes to payment |
| API 400 | Async params not awaited | Added await params, updated type | Receipt page works |
| Service fee integer | Rounding error | Proper decimal rounding (*100)/100 | Correct currency display |

All console logs use `[v0]` prefix for debugging.
