# PIN System Setup Guide

This document describes the 6-digit access PIN system with KudiSMS integration for bank account saving and withdrawal authorization.

## Prerequisites

1. **Neon Database**: Make sure your Neon database is connected and you have access to it.
2. **KudiSMS Account**: You need a KudiSMS account with SMS credits and an API token.
3. **Environment Variables**: Set the `KUDISMS_TOKEN` environment variable with your KudiSMS API key.

## Environment Variables Required

Add these to your `.env.local` file or Vercel project settings:

```env
KUDISMS_TOKEN=your_kudisms_api_token_here
```

## Database Setup

### 1. Run the Migration

Execute the SQL migration to create the required tables:

```bash
# Using Neon CLI
neon sql -f migrations/add-pins-and-kudi-sms.sql

# OR manually execute the SQL in your Neon dashboard
```

The migration creates three tables:
- **pins**: Stores temporary PIN records with 10-minute expiry
- **kudi_sms_balance**: Tracks your KudiSMS account balance
- **kudi_sms_logs**: Audit log for all SMS sends

### 2. Verify Tables

Check that the tables were created:

```sql
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('pins', 'kudi_sms_balance', 'kudi_sms_logs');
```

## API Routes

### POST /api/pins/request

Generates a 6-digit PIN, sends SMS via KudiSMS, and returns a PIN ID.

**Request:**
```json
{
  "purpose": "bank_account" | "withdrawal",
  "metadata": {
    "bank_code": "007",
    "bank_account_number": "1234567890",
    "bank_account_holder": "John Doe"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "PIN sent successfully",
  "pinId": "abc123def456"
}
```

### POST /api/pins/verify

Verifies the entered PIN and executes the associated action.

**Request:**
```json
{
  "pinId": "abc123def456",
  "pin": "123456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "PIN verified successfully",
  "purpose": "bank_account"
}
```

## Frontend Integration

### 1. Use the Hook

```tsx
import { usePinVerification } from '@/hooks/use-pin-verification';
import { PinModal } from '@/components/pin-modal';

export function BankAccountForm() {
  const pinVerification = usePinVerification();

  const handleSaveBank = async (formData) => {
    try {
      // Request PIN
      await pinVerification.requestPin('bank_account', {
        bank_code: formData.bankCode,
        bank_account_number: formData.accountNumber,
        bank_account_holder: formData.accountHolder,
      });
    } catch (error) {
      console.error('Failed to request PIN:', error);
    }
  };

  const handleVerifyPin = async (pin: string) => {
    try {
      await pinVerification.verifyPin(pin);
      // Action completed successfully
    } catch (error) {
      console.error('Failed to verify PIN:', error);
    }
  };

  return (
    <>
      <form onSubmit={handleSaveBank}>
        {/* Your form fields */}
        <button type="submit">Save Bank Account</button>
      </form>

      <PinModal
        isOpen={pinVerification.isOpen}
        pinId={pinVerification.pinId || ''}
        purpose={pinVerification.purpose}
        onClose={pinVerification.closeModal}
        onSubmit={handleVerifyPin}
        isLoading={pinVerification.isLoading}
      />
    </>
  );
}
```

### 2. Example: Bank Account Flow

```tsx
// In your bank details page component
const [isLoading, setIsLoading] = useState(false);
const pinVerification = usePinVerification();

const handleUpdateBankDetails = async (bankData) => {
  setIsLoading(true);
  try {
    await pinVerification.requestPin('bank_account', {
      bank_code: bankData.bank_code,
      bank_account_number: bankData.bank_account_number,
      bank_account_holder: bankData.bank_account_holder,
    });
  } catch (error) {
    toast.error(error.message);
  } finally {
    setIsLoading(false);
  }
};

const handleVerifyPin = async (pin: string) => {
  try {
    const result = await pinVerification.verifyPin(pin);
    toast.success('Bank account saved successfully!');
    // Refresh bank details or close modal
  } catch (error) {
    toast.error(error.message);
  }
};
```

### 3. Example: Withdrawal Flow

```tsx
const handleWithdrawal = async (withdrawalData) => {
  setIsLoading(true);
  try {
    // First create the withdrawal record in your database
    const withdrawalResponse = await fetch('/api/withdrawals/request', {
      method: 'POST',
      body: JSON.stringify(withdrawalData),
    });
    const withdrawal = await withdrawalResponse.json();

    // Then request PIN for authorization
    await pinVerification.requestPin('withdrawal', {
      withdrawal_id: withdrawal.id,
      amount: withdrawalData.amount,
    });
  } catch (error) {
    toast.error(error.message);
  } finally {
    setIsLoading(false);
  }
};

const handleVerifyPin = async (pin: string) => {
  try {
    const result = await pinVerification.verifyPin(pin);
    toast.success('Withdrawal authorized successfully!');
    // The withdrawal is now approved and processing
  } catch (error) {
    toast.error(error.message);
  }
};
```

## Phone Number Formatting

The system automatically converts Nigerian phone numbers to international format:
- `08012345678` → `2348012345678`
- `+2348012345678` → `2348012345678`
- `2348012345678` → `2348012345678` (already correct)

## KudiSMS Message Templates

Messages follow this format:
- **Bank Account**: "Your FoodBase access PIN is XXXXXX. Use this to save your bank account. Valid for 10 minutes. Do not share."
- **Withdrawal**: "Your FoodBase access PIN is XXXXXX. Use this to authorize your ₦X,XXX.00 withdrawal. Valid for 10 minutes. Do not share."

## Error Handling

Common errors from KudiSMS:
- **error_code "000"**: Success
- **error_code "109"**: No SMS balance available
- Other codes: Check KudiSMS API documentation

## Monitoring

### Check SMS Balance

```sql
SELECT balance, last_updated FROM kudi_sms_balance 
ORDER BY last_updated DESC LIMIT 1;
```

### View SMS Logs

```sql
SELECT * FROM kudi_sms_logs 
WHERE business_id = 'your_business_id' 
ORDER BY created_at DESC LIMIT 20;
```

### Check Expired Pins

```sql
SELECT * FROM pins 
WHERE expires_at < NOW() 
ORDER BY expires_at DESC;
```

## Security Considerations

1. **PIN Storage**: PINs are bcrypt hashed before storage
2. **Expiry**: PINs expire after 10 minutes
3. **One-time Use**: PINs are deleted after verification
4. **Rate Limiting**: Consider adding rate limiting to `/api/pins/request`
5. **Phone Verification**: Phone numbers are stored securely in the businesses table

## Troubleshooting

### SMS Not Sending
1. Check `KUDISMS_TOKEN` is set correctly
2. Check KudiSMS account balance via `/api/kudi-sms/balance`
3. Check phone number formatting
4. Review logs in `kudi_sms_logs` table

### PIN Verification Failing
1. Check PIN hasn't expired (10 minutes)
2. Check PIN is exactly 6 digits
3. Verify business_id matches
4. Check `pins` table for expired records

### Database Connection Issues
1. Verify `DATABASE_URL` is set
2. Check Neon connection is active
3. Verify migrations were applied

## API Endpoints for Monitoring

You can add these optional endpoints:

### GET /api/kudi-sms/balance
Returns current KudiSMS balance.

### GET /api/pins/logs
Returns recent PIN activity logs.
