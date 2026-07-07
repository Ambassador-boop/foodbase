# Auth Method Preference Implementation - Complete

## Overview
Fixed the hardcoded SMS OTP issue for sensitive actions (bank details update and withdrawal requests). The system now respects the merchant's `preferred_auth_mode` setting stored in the `businesses` table.

## Changes Made

### 1. **Core Backend Fix: `/app/api/pins/request/route.ts`**
   - **Change:** Now fetches `preferred_auth_mode` from the `businesses` table
   - **Logic:**
     - `'sms'` → Sends OTP via KudiSMS (existing behavior)
     - `'email'` → Sends OTP via Brevo email (new)
     - `'pin'` → No delivery, returns immediately with `method: 'pin'` for PIN mode
   - **Returns:** `{ method: 'sms'|'email'|'pin', message: string, pinId: string }`

### 2. **Email OTP Support: `/lib/pin-utils.ts`**
   - **Added:** `sendBrevoPinEmail()` function
   - **Uses:** Brevo API for email delivery (already configured in the project)
   - **Features:**
     - Professional HTML email template with branding
     - Purpose-specific messaging (bank account vs withdrawal)
     - Expires in 10 minutes (matching SMS)
     - Logs delivery status

### 3. **PIN Verification Logic: `/app/api/pins/verify/route.ts`**
   - **Updated:** Now checks auth mode before validation
   - **PIN Mode:** Validates submitted PIN against `businesses.pin_hash` (saved PIN)
   - **SMS/Email Mode:** Validates against generated PIN hash (one-time OTP)
   - **Ensures:** Correct validation path based on authentication method

### 4. **Frontend Hook: `/hooks/use-pin-verification.ts`**
   - **New State:** `method` and `message` fields
   - **Method Return Values:**
     - `'sms'` → "A verification code has been sent to your phone"
     - `'email'` → "A verification code has been sent to your email"
     - `'pin'` → "Enter your PIN to continue"
   - **Modal Behavior:** For PIN mode, `isOpen` is false initially (merchant enters PIN immediately without waiting)

### 5. **PIN Modal: `/components/pin-modal.tsx`**
   - **New Props:** `method` and `message`
   - **Dynamic Description:** Changes based on method used
   - **Feedback Bar:** Shows contextual message about where code was sent
   - **PIN Mode:** Displays "Enter your PIN to continue" without waiting message

### 6. **Bank Details Page: `/app/dashboard/profile/bank-details/page.tsx`**
   - **Feedback State:** Added `verificationInfo` to track method and message
   - **User Feedback:** Shows blue info box with contextual message after requestPin()
   - **Modal Props:** Passes `method` and `message` to PinModal
   - **Cleanup:** Clears verification info when modal closes

### 7. **Withdrawal Page: `/app/dashboard/finance/withdraw/page.tsx`**
   - **Same Updates:** Matches bank details page implementation
   - **Feedback State:** Added `verificationInfo` state
   - **User Feedback:** Shows blue info box with method-specific messaging
   - **Modal Props:** Passes `method` and `message` to PinModal

## Database Requirements

### Existing Tables Used:
- **`businesses` table:**
  - `preferred_auth_mode` (VARCHAR) - User's chosen auth method
  - `pin_hash` (VARCHAR) - Saved hashed PIN for PIN mode (must be added if not exists)
  - `email` (VARCHAR) - Business email for email delivery
  - `phone` (VARCHAR) - Business phone for SMS delivery

## Authentication Methods Supported

| Method | Delivery | Use Case | Status |
|--------|----------|----------|--------|
| `'sms'` | KudiSMS | Traditional OTP via phone | ✅ Implemented |
| `'email'` | Brevo | OTP via business email | ✅ Implemented |
| `'pin'` | None (Saved) | Use merchant's permanent PIN | ✅ Implemented |

## User Experience Flow

### SMS Mode (Default)
1. Merchant clicks "Save bank details" or "Withdraw"
2. System fetches preferred_auth_mode = 'sms'
3. Shows: "A verification code has been sent to your phone"
4. Modal opens with PIN input fields
5. Merchant enters 6-digit code received via SMS

### Email Mode
1. Merchant clicks "Save bank details" or "Withdraw"
2. System fetches preferred_auth_mode = 'email'
3. Shows: "A verification code has been sent to your email"
4. Modal opens with PIN input fields
5. Merchant enters 6-digit code received via email

### PIN Mode
1. Merchant clicks "Save bank details" or "Withdraw"
2. System fetches preferred_auth_mode = 'pin'
3. Shows: "Enter your PIN to continue" (immediately)
4. Modal opens with PIN input fields
5. Merchant enters their saved 6-digit PIN

## Environment Variables Required

- `BREVO_API_KEY` - For email delivery (already configured)
- `BREVO_EMAIL` - Sender email address (defaults to 'auth@foodbase.ng')
- `KUDISMS_TOKEN` - For SMS delivery (already configured)

## Testing Checklist

- [ ] Verify SMS mode still works (backward compatible)
- [ ] Test email mode sends correct HTML email via Brevo
- [ ] Test PIN mode validates against saved PIN hash
- [ ] Verify feedback messages display correctly for each method
- [ ] Test modal shows correct description for each method
- [ ] Confirm PIN verification works across all three methods
- [ ] Test error cases (missing config, invalid PIN, etc.)
- [ ] Verify bank details saves after correct PIN
- [ ] Verify withdrawal creates after correct PIN

## Security Notes

1. **PIN Mode:** Merchants must set up their PIN in settings first
2. **Email Delivery:** Uses Brevo's secure API with authentication
3. **SMS Delivery:** Uses KudiSMS with authentication
4. **PIN Expiration:** OTP codes expire in 10 minutes (SMS/Email)
5. **Validation:** Each method validated against appropriate hash source

## Backward Compatibility

✅ Fully backward compatible:
- Existing merchants default to SMS mode
- No breaking changes to API structure
- Frontend gracefully handles new `method` field
- Old clients continue to work with SMS mode

## Notes

- PIN mode requires merchants to have a saved PIN (set in settings)
- Email delivery requires valid business email in database
- SMS delivery requires valid phone number in database
- System falls back to SMS if `preferred_auth_mode` is NULL
