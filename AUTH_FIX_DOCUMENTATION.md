# Authentication Issue Fix - Detailed Investigation & Resolution

## Problem Statement
When trying to switch authentication modes in the security dashboard, the following error occurred:
- **UI Message**: "Unauthorized"
- **HTTP Status**: 401
- **Endpoint**: `/api/user/auth-mode/change`

---

## Root Cause Analysis

### What Was Wrong
The API endpoints were attempting to manually parse JWT tokens from the Authorization header using basic string manipulation:

```typescript
// ❌ WRONG - Manual JWT parsing
const authHeader = headersList.get('authorization');
if (authHeader) {
  const token = authHeader.replace('Bearer ', '');
  try {
    const decoded = JSON.parse(
      Buffer.from(token.split('.')[1], 'base64').toString()
    );
    userId = decoded.sub || decoded.userId;
  } catch {
    // Token parsing failed
  }
}

if (!userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
```

### Problems with This Approach
1. **No Token Verification**: Simply base64 decoding doesn't verify the token's signature
2. **Manual Header Parsing**: Doesn't use the project's built-in authentication system
3. **Cookie Handling**: Doesn't account for httpOnly cookies where tokens are stored
4. **Inconsistent with Project Pattern**: The project already has `getTokenFromRequest()` and `verifyToken()` utilities

---

## The Correct Approach

### Project's Authentication System
The project uses a custom JWT authentication system defined in `lib/auth.ts` with helper functions:

```typescript
// ✓ CORRECT - Using project's auth utilities
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

const token = await getTokenFromRequest(request);
if (!token) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const verified = await verifyToken(token);
if (!verified || !verified.userId) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

const userId = verified.userId as string;
```

### Why This Works
1. **`getTokenFromRequest(request)`**:
   - Extracts token from cookies (where it's stored)
   - Or from Authorization header as fallback
   - Handles both httpOnly and regular cookies

2. **`verifyToken(token)`**:
   - Validates JWT signature
   - Checks token expiration
   - Returns verified payload with userId
   - Returns null if verification fails

---

## Affected Endpoints - Fixed

### 1. `/api/user/auth-mode/change` (POST)
**Purpose**: Change user's preferred authentication mode

**Before**:
```typescript
// Manual token extraction → always returned 401
const token = authHeader.replace('Bearer ', '');
const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
```

**After**:
```typescript
// Proper authentication
const token = await getTokenFromRequest(request);
const verified = await verifyToken(token);
const userId = verified.userId as string;
```

---

### 2. `/api/user/auth-mode/current` (GET)
**Purpose**: Fetch user's current preferred auth mode

**Before**: Manual JWT parsing
**After**: Used `getTokenFromRequest()` and `verifyToken()`

---

### 3. `/api/user/password/request-change` (POST)
**Purpose**: Request OTP for password change

**Before**: Manual JWT parsing
**After**: Proper token verification

---

### 4. `/api/user/password/verify-and-change` (POST)
**Purpose**: Verify OTP and change password

**Before**: Manual JWT parsing, missing userId extraction
**After**: 
```typescript
const verified = await verifyToken(token);
const userId = verified.userId as string;
```

---

### 5. `/api/user/pin/request-setup` (POST)
**Purpose**: Request OTP for PIN setup

**Before**: Manual JWT parsing
**After**: Proper authentication

---

### 6. `/api/user/pin/verify-and-save` (POST)
**Purpose**: Verify OTP and save PIN

**Before**: Manual JWT parsing
**After**: Proper token verification

---

### 7. `/api/user/pin/remove` (POST)
**Purpose**: Remove user's PIN

**Before**: Manual JWT parsing
**After**: Proper authentication

---

### 8. `/api/user/pin/status` (GET)
**Purpose**: Check if user has PIN set

**Before**: Manual JWT parsing
**After**: Proper authentication

---

## How to Fix Similar Issues

When creating API endpoints that require authentication:

### ✅ DO This
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // 1. Extract token
    const token = await getTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Verify token
    const verified = await verifyToken(token);
    if (!verified || !verified.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Use userId
    const userId = verified.userId as string;

    // ... rest of your logic
  } catch (error) {
    console.error('[v0] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

### ❌ DON'T Do This
```typescript
// ❌ Never manually parse JWT
const token = authHeader.replace('Bearer ', '');
const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
const userId = decoded.sub || decoded.userId;

// ❌ Never trust a header without verification
// The above doesn't verify the signature, allowing anyone to fake a token
```

---

## Key Utilities Available

### From `@/lib/auth`:
- **`getTokenFromRequest(request: NextRequest)`**
  - Extracts token from request (cookies or Authorization header)
  - Returns: `string | null`

- **`verifyToken(token: string)`**
  - Verifies JWT signature and expiration
  - Returns: `{ userId: string; ... } | null`

- **`generateOTP()`**
  - Generates random OTP code
  - Used for email/SMS verification

- **`hashPassword(password: string)`**
  - Hashes password for storage
  - Uses bcryptjs

- **`verifyPassword(password: string, hash: string)`**
  - Verifies password against hash

---

## Testing the Fix

### Before Fix
```bash
curl -X POST http://localhost:3000/api/user/auth-mode/change \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer [token]" \
  -d '{"newMode":"email"}'

# Response: 401 Unauthorized
```

### After Fix
```bash
curl -X POST http://localhost:3000/api/user/auth-mode/change \
  -H "Content-Type: application/json" \
  -b "token=[valid_token]" \
  -d '{"newMode":"email"}'

# Response: 200 OK
# {
#   "success": true,
#   "message": "Authentication mode changed to email",
#   "preferredAuthMode": "email"
# }
```

---

## Summary

| Aspect | Before | After |
|--------|--------|-------|
| **Auth Method** | Manual JWT parsing | `getTokenFromRequest()` + `verifyToken()` |
| **Signature Verification** | ❌ None | ✅ Cryptographic verification |
| **Token Source** | Only Authorization header | Cookies + Authorization header |
| **Status on Auth Failure** | 401 (Eventually after decode fails) | 401 (Immediately on verification failure) |
| **Token Expiration Check** | ❌ None | ✅ Checked during verification |
| **All Endpoints Fixed** | N/A | 8 endpoints secured |

---

## Files Modified

1. `/api/user/auth-mode/change/route.ts`
2. `/api/user/auth-mode/current/route.ts`
3. `/api/user/password/request-change/route.ts`
4. `/api/user/password/verify-and-change/route.ts`
5. `/api/user/pin/request-setup/route.ts`
6. `/api/user/pin/verify-and-save/route.ts`
7. `/api/user/pin/remove/route.ts`
8. `/api/user/pin/status/route.ts`

---

## Verification Checklist

- [x] All 8 endpoints import from `@/lib/auth`
- [x] All use `getTokenFromRequest()` first
- [x] All use `verifyToken()` to validate
- [x] All extract `userId` from verified payload
- [x] All return 401 if token missing/invalid
- [x] All endpoints consistent with pattern
- [x] Frontend can call endpoints with credentials
- [x] No 401 errors on valid requests
