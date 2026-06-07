# PIN System - Quick Start Guide

## 1. Set Environment Variable

Add to your Vercel project or `.env.local`:
```env
KUDISMS_TOKEN=your_api_token_here
```

## 2. Run Database Migration

Execute the SQL migration to create tables:
```bash
# Option 1: Using Neon CLI
neon sql -f migrations/add-pins-and-kudi-sms.sql

# Option 2: Manually in Neon Dashboard
# Copy the contents of migrations/add-pins-and-kudi-sms.sql and execute in SQL editor
```

Tables created:
- `pins` - Temporary PIN storage (10-minute expiry)
- `kudi_sms_balance` - SMS balance tracking
- `kudi_sms_logs` - SMS audit logs

## 3. Use in Your Components

### Bank Account Flow

```tsx
import { BankDetailsWithPin } from '@/components/bank-details-with-pin';

export default function BankDetailsPage() {
  return (
    <BankDetailsWithPin
      onSuccess={() => {
        // Refresh data or show success message
      }}
    />
  );
}
```

### Withdrawal Flow

```tsx
import { WithdrawalWithPin } from '@/components/withdrawal-with-pin';

export default function WithdrawPage() {
  return (
    <WithdrawalWithPin
      availableBalance={5000}
      onSuccess={() => {
        // Refresh data
      }}
    />
  );
}
```

### Custom Implementation

```tsx
import { usePinVerification } from '@/hooks/use-pin-verification';
import { PinModal } from '@/components/pin-modal';

export function CustomComponent() {
  const pinVerification = usePinVerification();

  const handleRequest = async () => {
    await pinVerification.requestPin('bank_account', {
      bank_code: '007',
      bank_account_number: '1234567890',
      bank_account_holder: 'John Doe',
    });
  };

  const handleVerify = async (pin: string) => {
    await pinVerification.verifyPin(pin);
  };

  return (
    <>
      <button onClick={handleRequest}>Save Bank</button>
      <PinModal
        isOpen={pinVerification.isOpen}
        pinId={pinVerification.pinId || ''}
        purpose="bank_account"
        onClose={pinVerification.closeModal}
        onSubmit={handleVerify}
      />
    </>
  );
}
```

## 4. API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/pins/request` | POST | Generate PIN and send SMS |
| `/api/pins/verify` | POST | Verify PIN and execute action |
| `/api/kudi-sms/balance` | GET | Check SMS balance |
| `/api/kudi-sms/logs` | GET | View SMS logs |

## 5. Files Created

### Core System
- `lib/pin-utils.ts` - PIN and SMS utilities
- `app/api/pins/request/route.ts` - PIN generation endpoint
- `app/api/pins/verify/route.ts` - PIN verification endpoint

### UI Components
- `components/pin-modal.tsx` - PIN entry modal
- `components/bank-details-with-pin.tsx` - Bank account form example
- `components/withdrawal-with-pin.tsx` - Withdrawal form example

### Hooks
- `hooks/use-pin-verification.ts` - PIN verification hook

### Monitoring
- `app/api/kudi-sms/balance/route.ts` - SMS balance endpoint
- `app/api/kudi-sms/logs/route.ts` - SMS logs endpoint

### Database
- `migrations/add-pins-and-kudi-sms.sql` - Database migration

### Documentation
- `docs/PIN_SYSTEM_SETUP.md` - Detailed setup guide
- `docs/PIN_QUICK_START.md` - This file

## 6. Key Features

✅ **Secure**: PINs are bcrypt hashed  
✅ **Temporary**: PINs expire after 10 minutes  
✅ **One-time Use**: PINs are deleted after verification  
✅ **Audited**: All SMS sends are logged  
✅ **Formatted**: Phone numbers auto-convert to international format  
✅ **Balanced**: SMS balance tracked in database  

## 7. SMS Message Format

**Bank Account:**
> Your FoodBase access PIN is 123456. Use this to save your bank account. Valid for 10 minutes. Do not share.

**Withdrawal:**
> Your FoodBase access PIN is 123456. Use this to authorize your ₦5,000.00 withdrawal. Valid for 10 minutes. Do not share.

## 8. Error Handling

The system automatically handles:
- Invalid PIN codes
- Expired PINs (>10 minutes)
- SMS sending failures
- Low SMS balance (error 109)
- Phone number formatting

## 9. Phone Number Support

Automatically converts Nigerian phone numbers:
- `08012345678` → `2348012345678`
- `+2348012345678` → `2348012345678`
- `2348012345678` → `2348012345678` ✓

## 10. Testing

### Test Bank Account Flow
1. Navigate to bank details page
2. Fill in test bank details
3. Click "Save Bank Account"
4. Check SMS logs: `SELECT * FROM kudi_sms_logs LIMIT 1;`
5. Enter PIN from SMS
6. Verify success in database: `SELECT * FROM businesses WHERE id = '...' LIMIT 1;`

### Test Withdrawal Flow
1. Navigate to withdrawal page
2. Enter amount
3. Click "Request Withdrawal"
4. Enter PIN from SMS
5. Verify in withdrawals table

## 11. Support

For issues, check:
- **Missing env var**: Add `KUDISMS_TOKEN` to project settings
- **SMS not sent**: Check balance via `/api/kudi-sms/balance`
- **PIN expired**: PINs are valid for 10 minutes only
- **Database error**: Run migration again
- **Phone format**: System auto-converts, check logs for exact format

## 12. Next Steps

1. ✅ Set `KUDISMS_TOKEN` environment variable
2. ✅ Run database migration
3. ✅ Import components into your pages
4. ✅ Test with real phone numbers
5. ✅ Monitor SMS balance
6. ✅ Review SMS logs for auditing

---

For detailed information, see `docs/PIN_SYSTEM_SETUP.md`
