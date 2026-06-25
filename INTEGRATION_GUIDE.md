# Integration Guide: Auth Mode Verification in Bank Details & Withdraw Pages

This guide explains how to integrate the new authentication mode verification system into the existing `bank-details` and `withdraw` pages.

## Overview

The new system allows users to choose their preferred authentication method (Email OTP, SMS OTP, or PIN) for sensitive actions. The implementation uses a new hook `useAuthModeVerification` that abstracts the verification logic.

## Current Implementation

Both pages currently:
1. Import `PinModal` from `@/components/pin-modal`
2. Use `usePinVerification` hook
3. Always show a PIN verification modal before saving
4. Call `pinVerification.requestPin(purpose)` to trigger PIN verification

## Required Changes

### File: `/app/dashboard/profile/bank-details/page.tsx`

1. **Replace the PIN verification import:**
   ```tsx
   // OLD:
   import { usePinVerification } from '@/hooks/use-pin-verification';
   
   // NEW:
   import { useAuthModeVerification } from '@/hooks/use-auth-mode-verification';
   ```

2. **Update the hook usage in the component:**
   ```tsx
   // OLD:
   const pinVerification = usePinVerification();
   
   // NEW:
   const authVerification = useAuthModeVerification('bank_account');
   ```

3. **Update the verification request in `handleValidateSave`:**
   ```tsx
   // OLD:
   setPinRequired(true);
   try {
     const pinId = await pinVerification.requestPin('bank_account');
   }
   
   // NEW:
   try {
     await authVerification.initiateVerification();
     setPinRequired(true);
   }
   ```

4. **Update the PIN Modal to use the new auth mode:**
   ```tsx
   // In the Modal section, update:
   {pinRequired && authVerification.authMode && (
     <PinModal
       isOpen={authVerification.pinVerification.isOpen}
       onClose={() => {
         setPinRequired(false);
         authVerification.pinVerification.closeModal();
       }}
       onSubmit={async (pin) => {
         try {
           await authVerification.verifyWithCurrentMode(pin);
           await handlePinVerified();
         } catch (err) {
           console.error('Verification error:', err);
           setError('Verification failed. Please try again.');
         }
       }}
       purpose="bank_account"
       pinId={authVerification.pinVerification.pinId}
       isLoading={saving}
     />
   )}
   ```

### File: `/app/dashboard/finance/withdraw/page.tsx`

Apply the same changes as above, but use `purpose="withdrawal"` when calling `useAuthModeVerification`:

```tsx
const authVerification = useAuthModeVerification('withdrawal');
```

## Implementation Notes

1. **Backward Compatibility**: The current system defaults to SMS OTP (PIN), which maintains backward compatibility with existing users.

2. **Future Email OTP Support**: The `verifyWithCurrentMode` function includes placeholders for email OTP verification. When email OTP is implemented, both pages will automatically support it without additional changes.

3. **Error Handling**: Both modes (PIN and OTP) throw errors that are caught and displayed to the user. The error messages should guide users on how to proceed.

4. **Loading States**: The `isLoading` prop on `PinModal` should reflect the `saving` state in both pages.

5. **Purpose Parameter**: This parameter is important for logging and tracking different types of PINs/OTPs. Use:
   - `'bank_account'` for bank details page
   - `'withdrawal'` for withdrawal page

## Testing Checklist

After integration, test the following:

- [ ] Bank details page loads without errors
- [ ] Withdrawal page loads without errors
- [ ] Clicking "Save" on bank details shows PIN modal
- [ ] Clicking "Request Withdrawal" shows PIN modal
- [ ] PIN verification works as before
- [ ] Error messages display correctly
- [ ] User's preferred auth mode is respected (when User changes auth mode to 'email' or other modes)

## Future Improvements

1. **Email OTP Implementation**: Replace PIN modal with OTP modal when auth mode is 'email'
2. **SMS OTP Verification**: Could be implemented using the existing KudiSMS infrastructure
3. **Multi-factor Auth**: Could add support for requiring both PIN and OTP for maximum security
4. **Device Tracking**: Could store and display the devices that verified sensitive actions

## Code Examples

### Example: How to verify with PIN (current system)
```typescript
const authVerification = useAuthModeVerification('bank_account');

// User initiates an action that requires verification
await authVerification.initiateVerification();
setPinRequired(true);

// User enters PIN in modal
await authVerification.verifyWithCurrentMode(userPin);
// Verification successful, proceed with saving
```

### Example: How it will work with Email OTP (future)
```typescript
const authVerification = useAuthModeVerification('bank_account');

// Automatically sends OTP via email
await authVerification.initiateVerification();

// Shows OTP input modal instead of PIN modal
await authVerification.verifyWithCurrentMode(otpCode);
```

## Support

For questions or issues with this integration, please refer to:
- The Security Settings page at `/dashboard/security` for user preferences
- The API endpoints at `/api/user/*` for verification logic
