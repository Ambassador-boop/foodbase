# Service Fee Management & Revenue Tracking Implementation

## Overview
Successfully implemented a complete tiered service fee system replacing the fixed 7.5% fee, along with comprehensive admin revenue tracking and withdrawal management through Paystack.

---

## Database Changes Completed

### New Tables Created
1. **service_fee_config** - Stores admin's tiered service fee configuration
   - Columns: id, tier_value, service_fee, created_at, updated_at
   
2. **order_service_fees** - Tracks fees applied per order
   - Columns: id, order_id, service_fee_amount, service_fee_type, created_at
   - Supports both 'tiered' and 'legacy_percentage' types
   
3. **admin_revenue** - Tracks platform revenue summary
   - Columns: id, total_revenue, withdrawn_amount, available_balance, updated_at
   
4. **admin_bank_details** - Stores admin bank account for withdrawals
   - Columns: id, bank_code, account_number, account_name, paystack_recipient_id, is_active, created_at, updated_at
   
5. **admin_withdrawals** - Tracks admin withdrawal requests
   - Columns: id, amount, bank_code, account_number, account_name, paystack_transfer_id, status, created_at, updated_at

### Existing Table Modifications
- **orders** table: Added `service_fee_amount` column (NUMERIC)

### Default Service Fee Configuration
- 1000-3000: ₦100
- 3000-7000: ₦200
- 7000-15000: ₦300
- 15000-22000: ₦500
- 22000-30000: ₦700
- 30000+: ₦1000 (then ₦100 per additional ₦10,000)

---

## Pages Created

### Admin Pages

#### 1. `/admin/settings/service-fee`
- Configure tiered service fee structure
- Add/remove/edit tiers
- Validate tier values uniqueness
- Save configuration to database

#### 2. `/admin/settings/bank-details`
- Set up admin bank account for withdrawals
- Paystack account validation
- Update existing bank details
- Redirect to withdrawal if no account exists

#### 3. `/admin/revenue`
- Revenue dashboard with analytics
- Summary cards: Total Revenue, Available Balance, Withdrawn Amount
- Daily revenue breakdown (30-day history)
- Top restaurants by revenue ranking
- Recent transactions preview
- Link to detailed transactions and withdrawal

#### 4. `/admin/revenue/transactions`
- Complete paginated list of all service fee transactions
- Table view with: Restaurant, Customer, Service Fee, Order Total, Status, Date
- Pagination controls
- Link to individual transaction details

#### 5. `/admin/revenue/[id]`
- Detailed transaction view
- Transaction summary & metadata
- Customer information
- Order items breakdown
- Payment breakdown with fee type indicator
- Differentiate between tiered and legacy 7.5% fees

#### 6. `/admin/revenue/withdraw`
- Withdrawal request form
- Balance summary display
- Current bank account info
- Quick amount buttons (10K, 25K, 50K)
- Redirect to bank-details if no account set
- Paystack integration ready

### Customer-Facing Pages Updated

#### 1. `/[slug]/cart`
- Fetch service fee config on page load
- Calculate tiered service fee based on subtotal
- Display service fee in cart summary
- Show breakdown: Subtotal → Service Fee → Total

#### 2. `/[slug]/checkout`
- Fetch and use tiered service fee config
- Calculate dynamic service fee
- Include `serviceFeeType: 'tiered'` in order creation
- Display updated totals

#### 3. `/[slug]/receipt`
- Remove hardcoded "7.5%" text
- Show dynamic service fee amount
- Maintain full receipt functionality

---

## API Routes Created/Updated

### New Routes

#### Admin Service Fee
- **GET** `/api/admin/service-fee` - Fetch current configuration
- **POST** `/api/admin/service-fee` - Update configuration (admin only)

#### Admin Revenue
- **GET** `/api/admin/revenue` - Fetch revenue summary, daily breakdown, top restaurants
- **GET** `/api/admin/revenue/transactions` - Paginated transaction list (20 per page)
- **GET** `/api/admin/revenue/[id]` - Get specific transaction details with order items

#### Admin Bank Details
- **GET** `/api/admin/bank-details` - Fetch active bank account
- **POST** `/api/admin/bank-details` - Save/update bank account

#### Admin Withdrawals
- **GET** `/api/admin/withdrawals` - List withdrawal history
- **POST** `/api/admin/withdrawals` - Create withdrawal request, updates admin_revenue balance

### Updated Routes

#### Orders
- **POST** `/api/orders` - Now saves service fee data
  - Accepts `serviceFeeType` parameter
  - Saves to `service_fee_amount` column
  - Creates entry in `order_service_fees` table
  - Updates `admin_revenue` totals

---

## Utility Functions

### `/lib/service-fee.ts`
- `calculateServiceFee(subtotal, config)` - Calculate fee based on tiered config
- `getServiceFeeConfig()` - Fetch from database
- `getDefaultServiceFeeConfig()` - Returns default tiers
- `saveOrderServiceFee(orderId, amount, type)` - Save fee to database
- `updateServiceFeeConfig(tiers)` - Update admin config
- `markLegacyOrders()` - Mark existing orders with 7.5% as legacy

---

## Key Features

### Service Fee Calculation
- Dynamic tiering based on order subtotal
- Support for amounts above 30,000 with ₦100 per ₦10,000 increment
- Configurable tiers editable by admin
- Type tracking: 'tiered' vs 'legacy_percentage'

### Revenue Tracking
- Real-time revenue accumulation
- Withdrawn vs available balance tracking
- Daily breakdown analytics
- Restaurant performance ranking

### Withdrawal Flow
1. Admin checks available balance in `/admin/revenue/withdraw`
2. If no bank account → Redirect to `/admin/settings/bank-details`
3. Set bank via Paystack verification
4. Return to withdrawal & request transfer
5. Paystack processes → Creates withdrawal record
6. Reduces available_balance, increases withdrawn_amount

### Security & Validation
- Admin role verification on all admin endpoints
- Token-based authentication (Bearer token)
- Input validation on all forms
- Account number validation via Paystack
- Insufficient balance checks

---

## Admin Settings Integration

Updated `/admin/settings/page.tsx`:
- Added "Service Fee Management" section linking to `/admin/settings/service-fee`
- Added "Bank Account Management" section linking to `/admin/settings/bank-details`
- Both sections have descriptive text and buttons

---

## Migration Script

`scripts/add-service-fee-system.sql`:
- Creates all 5 new tables
- Adds service_fee_amount column to orders
- Inserts default tier configuration
- Creates necessary indexes for performance
- Initializes admin_revenue with default values

---

## Color Consistency

All new pages follow existing design system:
- Primary color for main actions and highlights
- Primary/5 background for info boxes
- Border color for separators
- Text colors follow existing pattern
- Responsive grid layouts

---

## Important Notes

1. **Legacy Orders**: Existing orders with 7.5% fees are handled by type field ('legacy_percentage' vs 'tiered')
2. **No Breaking Changes**: Old payment flow continues to work
3. **Client-Side Calculation**: Service fee calculated client-side but validated on backend
4. **Real-Time Updates**: Revenue updates happen when orders are created with successful payment status
5. **Paystack Integration**: Uses existing Paystack setup; no additional keys needed

---

## Testing Checklist

- [ ] Service fee tiers can be configured and saved
- [ ] Cart/checkout show correct tiered fees
- [ ] Orders save with service fee data
- [ ] Revenue dashboard displays correct totals
- [ ] Transactions list paginates correctly
- [ ] Transaction details show all order info
- [ ] Bank details can be set and updated
- [ ] Withdrawal creates record and updates balance
- [ ] Legacy orders still show 7.5% with correct fee type
- [ ] All admin endpoints require proper auth

---

## Future Enhancements

- Webhook integration for Paystack transfer status updates
- Email notifications for withdrawals
- CSV export for revenue reports
- Advanced filtering on transactions list
- Service fee history/audit log
- Scheduled/recurring withdrawal requests
- Multi-currency support

---

Generated: Service Fee Management Implementation Complete
