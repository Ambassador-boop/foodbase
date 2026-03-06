# Quick Reference - Issues Fixed

## 🔴 Issues Resolved

### 1. **Cloudinary Upload Errors**
**Problem:** "Bad request" errors when uploading images  
**Fix Applied:** Added file validation, error handling, and `resource_type` parameter  
**Files:** `components/menu-item-form.tsx`, `drink-form.tsx`, `addon-form.tsx`, `popular-dish-form.tsx`

### 2. **Drinks Not Showing in Cart**
**Problem:** Drinks couldn't be added to cart; cart page only showed menu items  
**Fix Applied:** Changed cart structure from `Map<string, number>` to array of CartItem objects supporting multiple types  
**Files:** `app/[slug]/page.tsx`, `app/[slug]/cart/page.tsx`

### 3. **Add-ons Display in Cart**
**Problem:** Menu items with add-ons showed separately; wanted "Item & Addon" format  
**Fix Applied:** Added `getItemName()` function that combines item name with selected add-on names  
**Example:** "Jollof Rice & Chicken & Plantain"  
**Files:** `app/[slug]/cart/page.tsx`

### 4. **Fixed ₦5,000 Checkout Total**
**Problem:** Checkout always showed ₦5,000 regardless of actual cart contents  
**Fix Applied:** Dynamically calculate total from cart items including add-on prices  
**Files:** `app/[slug]/checkout/page.tsx`

### 5. **Customer Email in Checkout**
**Problem:** Checkout asked for customer email; payment should use business owner email  
**Fix Applied:** Removed email field from form; uses business email fetched from API  
**Files:** `app/[slug]/checkout/page.tsx`

### 6. **No Location Selection**
**Problem:** No option to choose between restaurant pickup and delivery  
**Fix Applied:** Added RadioGroup with two options:
- "At Restaurant" → No address form, no delivery fee
- "Different Address" → Shows address form, adds ₦1,000 delivery fee  
**Files:** `app/[slug]/checkout/page.tsx`

### 7. **Paystack Integration**
**Problem:** Payment initialization required auth token; no business email support  
**Fix Applied:** Removed JWT requirement; accepts email parameter from checkout  
**Files:** `app/api/payments/initialize/route.ts`

---

## 🔧 How Data Flows

### Adding Items to Cart
```
User clicks "Add" button
  ↓
handleMenuItemClick() or handleDrinkAdd()
  ↓
If has add-ons → Show modal
If no add-ons → Direct add
  ↓
addToCart() or addToCartWithAddons()
  ↓
CartItem object created with: {id, type, name, price, quantity, addons}
  ↓
Stored in sessionStorage as JSON array
  ↓
Cart badge updated
```

### Cart Display
```
Load cart from sessionStorage
  ↓
For each item:
  - Get name: getItemName() combines item + addons
  - Calculate total: (price + addon prices) × quantity
  ↓
Show items with quantities
  ↓
Calculate subtotal
```

### Checkout Flow
```
Load cart items from sessionStorage
↓ Fetch business data (name, email)
↓
User selects location: "At Restaurant" or "Different Address"
↓
If "Different Address":
  - Show address form
  - Calculate delivery fee: ₦1,000
If "At Restaurant":
  - Hide address form
  - Delivery fee: ₦0
↓
User fills: Name, Phone, (Address if needed), Notes
↓
Submit → Create order with cart items
↓
Initialize Paystack payment with:
  - Amount: (subtotal + delivery fee)
  - Email: business.email (from API)
  - Reference: auto-generated
↓
Redirect to Paystack checkout
↓
Customer pays
↓
Paystack sends webhook to /api/payments/webhook
↓
Order marked as "confirmed"
↓
Business receives payment
```

---

## 📋 Required Paystack Setup

### Add to Paystack Dashboard
1. Go to Settings → API Keys & Webhooks
2. Add Webhook URL:
   ```
   https://your-domain.com/api/payments/webhook
   ```
3. Set to receive: `charge.success` event

### Environment Variables
```
PAYSTACK_SECRET_KEY=sk_live_xxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxx
APP_BASE_URL=https://your-domain.com
```

---

## 🧪 Testing the Fixes

### Test Cloudinary Upload
1. Go to Dashboard → Add Menu Item
2. Try uploading an image
3. Should succeed or show specific error message

### Test Drinks in Cart
1. Go to restaurant page
2. Click "Drinks" toggle
3. Click "Add" on a drink
4. Go to cart → Verify drink appears

### Test Add-ons Display
1. Add menu item with add-ons (e.g., Jollof Rice + Chicken)
2. Go to cart
3. Verify displays as "Jollof Rice & Chicken"

### Test Checkout
1. Add items to cart
2. Go to checkout
3. Select "At Restaurant" → Address field hidden, fee = ₦0
4. Change to "Different Address" → Address shown, fee = ₦1,000
5. Fill form and submit
6. Should redirect to Paystack

### Test Payment
1. Complete checkout flow
2. Enter test card: 4111 1111 1111 1111 (Paystack test card)
3. Enter any future date and CVC
4. Should redirect to success page
5. Check database → Order should have status: "confirmed"

---

## 📝 Cart Item Structure

```typescript
interface CartItem {
  id: string;              // Item or drink ID
  type: 'menu' | 'drink';  // Type of item
  name: string;            // Item name
  price: number;           // Base price (without addons)
  image_url?: string;      // Image URL
  quantity: number;        // Quantity ordered
  addons?: {               // Selected add-ons
    id: string;
    name: string;
    price: number;         // Add-on price
  }[];
}
```

---

## 🐛 Common Issues & Solutions

### Issue: Cloudinary upload still fails
**Check:**
- [ ] NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is set
- [ ] Upload preset "foodbase_upload" exists in Cloudinary
- [ ] File size < 10MB
- [ ] File is actually an image

### Issue: Drinks not appearing in cart
**Check:**
- [ ] Are drinks created in dashboard?
- [ ] Does restaurant have drinks assigned?
- [ ] Browser sessionStorage not cleared?
- [ ] Check browser console for errors

### Issue: Cart total shows ₦0
**Check:**
- [ ] Cart items actually exist in sessionStorage
- [ ] Items have price values
- [ ] Try refresh page
- [ ] Check browser console

### Issue: Checkout shows error
**Check:**
- [ ] Cart is not empty
- [ ] Restaurant data loaded (check network tab)
- [ ] All required fields filled
- [ ] Check browser console for error message

### Issue: Paystack payment not redirecting
**Check:**
- [ ] PAYSTACK_SECRET_KEY is valid
- [ ] Paystack API is reachable
- [ ] Amount > 0
- [ ] Email is valid format

---

## 📚 Documentation

See these files for more details:
- `FIXES_APPLIED.md` - Detailed explanation of all changes
- `PAYSTACK_SETUP.md` - Paystack webhook setup and testing
- `QUICK_REFERENCE.md` - This file (quick overview)

---

## ✅ Verification Checklist

Before going to production:

- [ ] All Cloudinary uploads working
- [ ] Drinks showing in cart
- [ ] Add-ons combining properly in cart display
- [ ] Checkout total calculated correctly
- [ ] Location selection working (with/without address)
- [ ] Delivery fee logic correct
- [ ] Paystack webhook URLs configured
- [ ] Environment variables all set
- [ ] Test payment completed successfully
- [ ] Order status updates to "confirmed"
