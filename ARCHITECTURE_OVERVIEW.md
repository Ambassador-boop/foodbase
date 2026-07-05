# Security System Architecture Overview

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Sidebar Navigation                    Dashboard                 │
│  ├─ Settings button    ──────────>   /dashboard/settings         │
│  │  (gear icon)                       (Settings Hub Page)        │
│  │                                                                │
│  └─ Security link  ──────────>   /dashboard/security            │
│                                   (Security Page)                │
│                                   ├─ Change Password Section     │
│                                   ├─ Auth Mode Selector          │
│                                   └─ PIN Management              │
│                                       ├─ PIN Setup Modal         │
│                                       └─ PIN Remove Form         │
│                                                                   │
│  PIN Setup Modal              PIN Setup Page                     │
│  ├─ Intro Step      ─────>    /dashboard/security/pin           │
│  └─ PIN Entry Step            ├─ PIN Input                      │
│                                ├─ OTP Verification              │
│                                └─ Success Page                  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                                   ↓
                          (All use JWT Auth)
                                   ↓
┌─────────────────────────────────────────────────────────────────┐
│                     API LAYER (Next.js Routes)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Authentication Module                                            │
│  ├─ getTokenFromRequest()      [Extract JWT from request]       │
│  └─ verifyToken()              [Validate JWT signature]         │
│         ↓                                                         │
│  Used by all 8 endpoints                                         │
│                                                                   │
│  Password Management             Auth Mode Control               │
│  ├─ POST request-change    ←→   ├─ POST change                  │
│  └─ POST verify-and-change ←→   └─ GET current                 │
│         (OTP via Email)             (Database update)            │
│                                                                   │
│  PIN Management                                                   │
│  ├─ POST request-setup     [Generate & send OTP]                │
│  ├─ POST verify-and-save   [Save PIN as hash]                   │
│  ├─ POST remove            [Delete PIN]                         │
│  └─ GET status             [Check PIN set]                      │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                                   ↓
                        (Authenticate & Validate)
                                   ↓
┌─────────────────────────────────────────────────────────────────┐
│                  BUSINESS LOGIC LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  User Authentication          Password Management                 │
│  ├─ Check token validity       ├─ Hash password (bcryptjs)      │
│  ├─ Extract userId             ├─ Compare passwords             │
│  └─ Return 401 if invalid      └─ Update users table            │
│                                                                   │
│  OTP Management               PIN Management                     │
│  ├─ Generate 6-digit code      ├─ Hash PIN (bcryptjs)           │
│  ├─ Set 10-min expiration      ├─ Compare PIN                   │
│  ├─ Store in OTP table         ├─ Store pin_set_at              │
│  └─ Send via Brevo email       └─ Mark verified                 │
│                                                                   │
│  Auth Mode Storage                                               │
│  ├─ Update users.preferred_auth_mode                            │
│  └─ Return current mode                                         │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                                   ↓
┌─────────────────────────────────────────────────────────────────┐
│                   DATA LAYER (Neon PostgreSQL)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  users Table                   businesses Table                  │
│  ├─ id (PK)                    ├─ id (PK)                       │
│  ├─ email                      ├─ owner_id (FK)                 │
│  ├─ password_hash              ├─ name                          │
│  ├─ email_verified             ├─ preferred_auth_mode  ────┐    │
│  ├─ updated_at                 └─ pin_set_at           ────┤    │
│  └─ preferred_auth_mode ──────┐                             │    │
│                                 │                             │    │
│  password_reset_otps Table      │  OTP Tables                  │
│  ├─ id (PK)                     │  ├─ id                       │
│  ├─ user_id (FK)                │  ├─ user_id                  │
│  ├─ otp_code                    │  ├─ otp_code                 │
│  ├─ is_verified                 │  ├─ purpose                  │
│  ├─ created_at                  │  ├─ expires_at               │
│  └─ expires_at                  │  └─ created_at               │
│                                  │                              │
│  ← → ← → ← → ← → ← → ← → ← → ← ┴ → ← → ← → ← → ← → ← → ← → ←   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow Examples

### 1. Setting Up a PIN

```
User clicks "Set Up PIN"
        ↓
PIN Setup Modal appears (intro)
        ↓
User enters PIN in modal
        ↓
onClick "Continue"
        ↓
POST /api/user/pin/request-setup
  ├─ getTokenFromRequest() → Extract JWT
  ├─ verifyToken() → Validate & get userId
  ├─ generateOTP() → Create 6-digit code
  ├─ Store in password_reset_otps table
  └─ sendOTPEmail() → Brevo API
        ↓
redirect to /dashboard/security/pin
        ↓
OTP Verification Page shown
        ↓
User enters OTP
        ↓
POST /api/user/pin/verify-and-save
  ├─ getTokenFromRequest() → Extract JWT
  ├─ verifyToken() → Validate & get userId
  ├─ Query password_reset_otps for valid OTP
  ├─ Check OTP not expired & not verified
  ├─ Verify OTP code matches
  ├─ hashPin() → bcryptjs hash
  ├─ UPDATE businesses SET pin_set_at = NOW()
  └─ Mark OTP as verified
        ↓
Success page shown
        ↓
Auto-redirect to /dashboard/security
        ↓
PIN Management section now shows "Active"
```

### 2. Changing Authentication Mode

```
User selects "Email OTP"
        ↓
onclick handler fires
        ↓
Check: Is this a new mode? (not current)
Check: If PIN mode, is PIN set?
        ↓
POST /api/user/auth-mode/change
  ├─ getTokenFromRequest() → Extract JWT
  ├─ verifyToken() → Validate & get userId
  ├─ Validate mode is valid ('email'|'sms'|'pin')
  ├─ UPDATE users SET preferred_auth_mode = 'email'
  └─ Return success
        ↓
Component updates local state
        ↓
Visual indicator updates immediately
        ↓
Success message appears
```

### 3. Changing Password

```
User enters current password + new password
        ↓
onClick "Request Verification Code"
        ↓
POST /api/user/password/request-change
  ├─ getTokenFromRequest() → Extract JWT
  ├─ verifyToken() → Validate & get userId
  ├─ Query users for current user
  ├─ verifyPassword() → Check current password
  ├─ generateOTP() → Create OTP
  ├─ Store in password_reset_otps
  └─ sendOTPEmail() → Brevo
        ↓
OTP input field appears
        ↓
User enters OTP
        ↓
onClick "Verify & Update"
        ↓
POST /api/user/password/verify-and-change
  ├─ getTokenFromRequest() → Extract JWT
  ├─ verifyToken() → Validate & get userId
  ├─ Query password_reset_otps
  ├─ Verify OTP valid & not expired
  ├─ hashPassword() → bcryptjs hash
  ├─ UPDATE users SET password_hash = new_hash
  └─ Mark OTP as verified
        ↓
Success message shown
```

---

## Component Hierarchy

```
SecurityPage (Server Component)
├─ useEffect: Fetch auth mode & PIN status
├─ State: preferredAuthMode, hasPinSet
└─ Children:
    ├─ ChangePasswordSection (Client)
    │   └─ Form inputs + OTP modal
    │
    ├─ AuthModeSelectorSection (Client)
    │   ├─ Radio buttons (Email/SMS/PIN)
    │   ├─ Current mode display
    │   └─ Mode change handler
    │
    ├─ PINManagementSection (Client)
    │   ├─ State: PIN status, removePinInput
    │   ├─ PinSetupModal (Client)
    │   │   └─ Two-step modal (Intro → PIN input)
    │   └─ PIN removal form (if PIN set)
    │
    └─ Active Sessions Section (Placeholder)

PINSetupPage (Client Component)
├─ useRouter for navigation
├─ State: step, pin, confirmPin, otp, error
├─ Timer countdown (10 minutes)
└─ Three screens:
    ├─ PIN Input Screen
    ├─ OTP Verification Screen
    └─ Success Screen
```

---

## Authentication Flow

```
Client Request
        ↓
┌──────────────────────────────────┐
│ getTokenFromRequest(request)     │
├──────────────────────────────────┤
│ 1. Check for token in cookies    │
│ 2. Or check Authorization header │
│ 3. Return token or null          │
└──────────────────────────────────┘
        ↓
┌──────────────────────────────────┐
│ verifyToken(token)               │
├──────────────────────────────────┤
│ 1. Verify JWT signature          │
│ 2. Check expiration              │
│ 3. Decode payload                │
│ 4. Return { userId, ... } or null
└──────────────────────────────────┘
        ↓
if (!verified || !verified.userId)
    → return 401 Unauthorized
else
    → Proceed with userId
```

---

## Database Schema Relationships

```
users (1) ──────────────┐
                         │
                         │ preferred_auth_mode
                         │
                         ├─ 'email' → Email OTP
                         ├─ 'sms'   → SMS OTP  
                         └─ 'pin'   → PIN required
                         
businesses (1) ─────────┬──────────────────┐
                         │                   │
                    preferred_auth_mode   pin_set_at
                         │                   │
                    Same as above       TIMESTAMP
                                        (NULL if not set)

password_reset_otps (N)
├─ user_id → users
├─ otp_code
├─ is_verified (boolean)
└─ expires_at (10 minutes)

Other OTP Tables (N)
├─ user_id → users
├─ otp_code
├─ purpose ('pin_setup', 'password_change')
└─ expires_at
```

---

## Security Layers

```
┌─ Layer 1: Transport Security ─────────────────────┐
│ HTTPS only, httpOnly cookies                      │
└───────────────────────────────────────────────────┘
                    ↓
┌─ Layer 2: JWT Authentication ─────────────────────┐
│ Token extracted, verified, userId extracted       │
│ Returns 401 if invalid or expired                 │
└───────────────────────────────────────────────────┘
                    ↓
┌─ Layer 3: Business Logic Validation ───────────────┐
│ Current password verification                      │
│ OTP validity & expiration checks                   │
│ PIN requirements validation                        │
└───────────────────────────────────────────────────┘
                    ↓
┌─ Layer 4: Data Hashing ─────────────────────────┐
│ Passwords hashed (bcryptjs)                      │
│ PINs hashed (bcryptjs)                           │
│ OTP codes one-time use (marked verified)         │
└──────────────────────────────────────────────────┘
                    ↓
┌─ Layer 5: Database Storage ──────────────────────┐
│ Sensitive data never stored plaintext            │
│ Timestamps for audit trail                       │
│ Foreign key relationships maintained             │
└──────────────────────────────────────────────────┘
```

---

## File Organization

```
app/
├─ dashboard/
│   ├─ settings/
│   │   └─ page.tsx                 [Settings Hub]
│   ├─ security/
│   │   ├─ page.tsx                 [Security Dashboard]
│   │   ├─ pin/
│   │   │   └─ page.tsx             [PIN Setup Page]
│   │   └─ layout.tsx               [if needed]
│   └─ layout.tsx                   [Updated: Settings button]
│
├─ api/
│   └─ user/
│       ├─ auth-mode/
│       │   ├─ change/route.ts      [POST: Change mode]
│       │   └─ current/route.ts     [GET: Get mode]
│       ├─ password/
│       │   ├─ request-change/route.ts      [POST: OTP request]
│       │   └─ verify-and-change/route.ts   [POST: Save password]
│       └─ pin/
│           ├─ request-setup/route.ts       [POST: OTP request]
│           ├─ verify-and-save/route.ts     [POST: Save PIN]
│           ├─ remove/route.ts              [POST: Delete PIN]
│           └─ status/route.ts              [GET: Check PIN]
│
components/
├─ security/
│   ├─ pin-setup-modal.tsx          [PIN Setup Modal]
│   ├─ change-password-section.tsx  [Password Change]
│   ├─ auth-mode-selector.tsx       [Auth Mode Selection]
│   └─ pin-management.tsx           [PIN Management]
│
hooks/
└─ use-auth-mode-verification.ts    [Helper Hook]

lib/
├─ auth.ts                          [Auth Utilities]
├─ pin-utils.ts                     [PIN Hashing]
└─ email.ts                         [Email/OTP via Brevo]
```

---

## Request/Response Examples

### Change Auth Mode Request
```json
POST /api/user/auth-mode/change
Content-Type: application/json
Cookie: token=eyJhbGc...

{
  "newMode": "email"
}
```

### Change Auth Mode Response
```json
200 OK

{
  "success": true,
  "message": "Authentication mode changed to email",
  "preferredAuthMode": "email"
}
```

### Request PIN Setup
```json
POST /api/user/pin/request-setup
Content-Type: application/json
Cookie: token=eyJhbGc...

{}
```

### Request PIN Setup Response
```json
200 OK

{
  "otpId": "uuid-here",
  "expiresAt": "2026-07-05T08:40:00Z"
}
```

### Verify & Save PIN
```json
POST /api/user/pin/verify-and-save
Content-Type: application/json
Cookie: token=eyJhbGc...

{
  "otpId": "uuid-here",
  "otp": "123456",
  "pin": "1234"
}
```

### Verify & Save PIN Response
```json
200 OK

{
  "success": true,
  "message": "PIN saved successfully"
}
```

---

## Summary

- **8 API Endpoints**: All properly authenticated
- **4 Frontend Components**: Reusable and modular
- **3 Database Tables**: Properly normalized
- **5 Security Layers**: Multiple safeguards
- **100% JWT Auth**: No more 401 errors
- **Complete OTP System**: Email delivery
- **PIN Hashing**: Bcryptjs for security
- **Audit Trail**: pin_set_at timestamps
