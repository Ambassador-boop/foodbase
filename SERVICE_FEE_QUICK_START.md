# Service Fee System - Quick Start Guide

## Getting Started

### 1. Configure Service Fees (Admin)
1. Go to **Admin Settings** → **Manage Bank Account** → **Configure Service Fees**
2. You'll see the default tier structure:
   - 1000-3000: ₦100
   - 3000-7000: ₦200
   - 7000-15000: ₦300
   - 15000-22000: ₦500
   - 22000-30000: ₦700
   - 30000+: ₦1000
3. Click **Add Tier** to add new tiers
4. Click **Save Configuration** to persist changes

### 2. Set Up Bank Account (Admin)
1. Go to **Admin Settings** → **Manage Bank Account**
2. Select your bank from dropdown
3. Enter account number
4. Click **Validate Account** (verifies via Paystack)
5. Click **Save Bank Details** once validated
6. You'll be redirected to withdrawal page

### 3. Monitor Revenue (Admin)
1. Click **Revenue Dashboard** icon (trending arrow) in top right of `/admin/revenue`
2. View:
   - **Summary Cards**: Total Revenue, Available Balance, Withdrawn
   - **Daily Breakdown**: 30-day revenue history
   - **Top Restaurants**: Rankings by fees generated
   - **Recent Transactions**: Latest 5 transactions
3. Click **View All** to see complete transactions list

### 4. View Transaction Details (Admin)
1. From Transactions list → Click **View** button on any row
2. See complete breakdown:
   - Transaction ID & Order ID
   - Restaurant & customer info
   - Order items with prices
   - Service fee type (Tiered vs Legacy 7.5%)
   - Payment breakdown

### 5. Withdraw Revenue (Admin)
1. Go to `/admin/revenue/withdraw`
2. If no bank account → Click **Add Bank Account** button
3. Your balance appears in 3 cards: Total, Withdrawn, Available
4. Enter amount or click quick buttons (₦10K, ₦25K, ₦50K)
5. Click **Request Withdrawal** - processed via Paystack
6. Balance updates immediately (deducts from available)

### 6. Customer Experience (No Changes)
1. Open any restaurant menu
2. Add items to cart
3. Go to checkout
4. **Service fee is now calculated dynamically** based on order total:
   - If subtotal is ₦2,500 → Service fee is ₦100
   - If subtotal is ₦5,000 → Service fee is ₦200
   - If subtotal is ₦10,000 → Service fee is ₦300
   - etc.
5. Complete payment as normal
6. Receipt shows updated service fee (no longer hardcoded 7.5%)

---

## API Testing (For Development)

### Fetch Service Fee Config
```bash
curl http://localhost:3000/api/admin/service-fee
```

### Update Service Fee Config
```bash
curl -X POST http://localhost:3000/api/admin/service-fee \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "tiers": [
      { "tier_value": 1000, "service_fee": 100 },
      { "tier_value": 5000, "service_fee": 250 }
    ]
  }'
```

### Get Revenue Summary
```bash
curl http://localhost:3000/api/admin/revenue \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

### Create Withdrawal
```bash
curl -X POST http://localhost:3000/api/admin/withdrawals \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "amount": 50000,
    "bank_code": "050",
    "account_number": "0123456789",
    "account_name": "John Doe"
  }'
```

---

## Database Verification

### Check Service Fee Config
```sql
SELECT * FROM service_fee_config ORDER BY tier_value;
```

### Check Order Service Fees
```sql
SELECT * FROM order_service_fees LIMIT 10;
```

### Check Admin Revenue
```sql
SELECT * FROM admin_revenue;
```

### Check Withdrawal History
```sql
SELECT * FROM admin_withdrawals ORDER BY created_at DESC;
```

---

## Known Limitations & Notes

1. **Paystack Integration**: Withdrawals are created but actual transfer requires Paystack webhook implementation
2. **Legacy Orders**: Orders created before this feature use 'legacy_percentage' type for 7.5%
3. **Real-Time**: Revenue updates happen immediately when orders are created
4. **No Rollback**: If withdrawal is created but not processed, admin must delete manually
5. **Auth Required**: All admin endpoints require Bearer token authentication

---

## Troubleshooting

### "Bank details not found" error
- Solution: Go to `/admin/settings/bank-details` and set up account first

### Service fee not calculating correctly
- Check that service fee config is saved: `/api/admin/service-fee`
- Verify tier_value and service_fee are correct numbers (not strings)

### Withdrawal balance not updating
- Refresh page to see latest balance
- Check `admin_revenue` table: `available_balance - withdrawn_amount` should equal balance

### Transaction details showing error
- Ensure order exists and has service_fee_amount in database
- Check `order_service_fees` table for matching order_id

---

## File Structure Reference

```
/admin
  /settings
    - page.tsx (main settings)
    /service-fee
      - page.tsx (configure fees)
    /bank-details
      - page.tsx (set bank account)
  /revenue
    - page.tsx (dashboard)
    /transactions
      - page.tsx (list all)
    /[id]
      - page.tsx (transaction details)
    /withdraw
      - page.tsx (withdrawal request)

/api/admin
  /service-fee
    - route.ts (GET/POST config)
  /revenue
    - route.ts (GET summary)
    /transactions
      - route.ts (GET paginated list)
    /[id]
      - route.ts (GET details)
  /bank-details
    - route.ts (GET/POST bank)
  /withdrawals
    - route.ts (GET/POST withdrawals)

/lib
  - service-fee.ts (utility functions)
```

---

## Support

For issues or questions:
1. Check SERVICE_FEE_IMPLEMENTATION.md for technical details
2. Review database schema in migration script
3. Check console logs for error messages
4. Verify auth token is valid and admin role
