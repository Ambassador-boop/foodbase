# Database Schema Documentation

## Security & Authentication Tables

### 1. **users** (Existing Table - Modified)
Stores user account information with authentication preferences.

**Columns:**
- `id` (VARCHAR, PRIMARY KEY)
- `email` (VARCHAR, UNIQUE)
- `first_name` (VARCHAR)
- `last_name` (VARCHAR)
- `password_hash` (VARCHAR) - Hashed password
- `phone` (VARCHAR)
- `profile_picture_url` (VARCHAR)
- `preferred_auth_mode` (VARCHAR) - 'email' | 'sms' | 'pin' (default: 'sms')
- `role` (ENUM: 'user', 'admin', 'business_owner')
- `is_active` (BOOLEAN, default: true)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Purpose:** Central user account table. The `preferred_auth_mode` column determines which verification method is used for sensitive operations.

**Indexes:**
- PRIMARY KEY: id
- Unique: email

---

### 2. **businesses** (Existing Table - Modified)
Stores business information with security settings.

**Columns:**
- `id` (VARCHAR, PRIMARY KEY)
- `owner_id` (VARCHAR, FOREIGN KEY to users)
- `name` (VARCHAR)
- `email` (VARCHAR)
- `phone` (VARCHAR)
- `description` (TEXT)
- `slug` (VARCHAR)
- `logo_url` (VARCHAR)
- `cover_image_url` (VARCHAR)
- `address` (VARCHAR)
- `city` (VARCHAR)
- `state` (VARCHAR)
- `postal_code` (VARCHAR)
- `country` (VARCHAR)
- `bank_account_number` (VARCHAR)
- `bank_account_holder` (VARCHAR)
- `bank_code` (VARCHAR)
- `available_balance` (NUMERIC)
- `pending_balance` (NUMERIC)
- `total_orders` (INT)
- `is_active` (BOOLEAN)
- `preferred_auth_mode` (VARCHAR) - 'email' | 'sms' | 'pin' (default: 'sms')
- `pin_hash` (VARCHAR) - Hashed PIN (bcryptjs)
- `pin_set_at` (TIMESTAMP) - When PIN was last created/updated
- `availability` (JSONB)
- `created_at` (TIMESTAMP)
- `updated_at` (TIMESTAMP)

**Purpose:** Business profile with security settings. PIN-based auth is stored at business level for owner authentication.

**Indexes:**
- PRIMARY KEY: id
- FOREIGN KEY: owner_id
- Index: slug

---

### 3. **password_reset_otps** (Existing Table)
Stores OTP codes for password reset flow (when user forgets password).

**Columns:**
- `id` (VARCHAR, PRIMARY KEY)
- `user_id` (VARCHAR, FOREIGN KEY to users)
- `email` (VARCHAR)
- `otp_code` (VARCHAR) - 6-digit code
- `is_verified` (BOOLEAN, default: false)
- `created_at` (TIMESTAMP)
- `expires_at` (TIMESTAMP) - Usually 10 minutes from creation

**Purpose:** Tracks forgot password OTP requests. User requests reset, receives OTP via email, verifies it, then sets new password.

**Indexes:**
- PRIMARY KEY: id
- Index: user_id
- Index: email

---

### 4. **password_change_otps** (New Table)
Stores OTP codes for password change flow (when user changes their own password from security settings).

**Columns:**
- `id` (VARCHAR, PRIMARY KEY)
- `user_id` (VARCHAR, FOREIGN KEY to users)
- `email` (VARCHAR)
- `otp_code` (VARCHAR) - 6-digit code
- `is_verified` (BOOLEAN, default: false)
- `created_at` (TIMESTAMP, default: CURRENT_TIMESTAMP)
- `expires_at` (TIMESTAMP) - Usually 10 minutes from creation

**Purpose:** Tracks password change OTP requests from the security dashboard. Different from password reset - requires current password validation first.

**Indexes:**
- PRIMARY KEY: id
- Index: user_id

**Related Endpoints:**
- POST `/api/user/password/request-change` - Initiates flow
- POST `/api/user/password/verify-and-change` - Completes flow

---

### 5. **email_otp_logs** (New Table)
Comprehensive log of all email OTP requests for audit and security tracking.

**Columns:**
- `id` (VARCHAR, PRIMARY KEY)
- `user_id` (VARCHAR, FOREIGN KEY to users)
- `email` (VARCHAR)
- `otp_code` (VARCHAR) - 6-digit code
- `purpose` (VARCHAR) - 'password_change' | 'pin_setup' | 'auth_mode_change'
- `status` (VARCHAR) - 'pending' | 'verified' | 'expired' | 'used'
- `created_at` (TIMESTAMP, default: CURRENT_TIMESTAMP)
- `verified_at` (TIMESTAMP) - When OTP was verified
- `expires_at` (TIMESTAMP)
- `metadata` (JSONB) - Additional context (IP, user agent, etc.)

**Purpose:** Maintains audit trail of all email-based OTP requests. Useful for security logs, compliance, and detecting suspicious activity.

**Indexes:**
- PRIMARY KEY: id
- Composite Index: (user_id, purpose)
- Index: status, expires_at

---

### 6. **pins** (Existing Table)
Stores PIN hashes for user authentication (legacy or transient PIN storage).

**Columns:**
- `id` (VARCHAR, PRIMARY KEY)
- `business_id` (VARCHAR, FOREIGN KEY to businesses)
- `pin_hash` (VARCHAR) - Hashed PIN
- `purpose` (VARCHAR) - 'user_security' | 'transaction'
- `created_at` (TIMESTAMP)
- `expires_at` (TIMESTAMP)
- `metadata` (JSONB)

**Purpose:** General PIN storage. The primary PIN for sensitive operations is stored in `businesses.pin_hash`, but this table can track temporary or special-purpose PINs.

**Indexes:**
- PRIMARY KEY: id
- Index: business_id

---

### 7. **auth_mode_change_history** (New Table)
Audit trail for authentication mode changes.

**Columns:**
- `id` (VARCHAR, PRIMARY KEY)
- `user_id` (VARCHAR, FOREIGN KEY to users)
- `previous_mode` (VARCHAR) - 'email' | 'sms' | 'pin' | null
- `new_mode` (VARCHAR) - 'email' | 'sms' | 'pin'
- `change_reason` (VARCHAR) - Reason for change if provided
- `ip_address` (VARCHAR) - IP of the requester
- `user_agent` (VARCHAR) - Browser/device info
- `created_at` (TIMESTAMP, default: CURRENT_TIMESTAMP)
- `metadata` (JSONB) - Additional context

**Purpose:** Maintains detailed audit log of who changed their auth mode, when, and from where. Critical for security compliance and fraud detection.

**Indexes:**
- PRIMARY KEY: id
- Composite Index: (user_id, created_at DESC)
- Index: user_id

**Example Use Case:**
```sql
-- Get last 10 auth mode changes for a user
SELECT * FROM auth_mode_change_history 
WHERE user_id = $1 
ORDER BY created_at DESC 
LIMIT 10;
```

---

### 8. **pin_verification_attempts** (New Table)
Tracks PIN verification attempts to implement rate limiting and lockout protection.

**Columns:**
- `id` (VARCHAR, PRIMARY KEY)
- `user_id` (VARCHAR, FOREIGN KEY to users)
- `business_id` (VARCHAR, FOREIGN KEY to businesses)
- `attempt_count` (INT, default: 1)
- `last_attempted_at` (TIMESTAMP, default: CURRENT_TIMESTAMP)
- `is_locked` (BOOLEAN, default: false)
- `locked_until` (TIMESTAMP) - When lockout expires
- `created_at` (TIMESTAMP, default: CURRENT_TIMESTAMP)
- `metadata` (JSONB) - Failed attempts details

**Purpose:** Prevents brute force attacks on PIN by tracking failed attempts and implementing automatic lockout.

**Security Rules:**
- Lock account after 5 failed attempts
- Lockout duration: 15 minutes
- Reset counter on successful verification
- Log all failed attempts for audit trail

**Indexes:**
- PRIMARY KEY: id
- Composite Index: (user_id, business_id)
- Index: is_locked, locked_until

**Example Use Case:**
```sql
-- Check if user is locked out
SELECT * FROM pin_verification_attempts 
WHERE user_id = $1 AND business_id = $2 AND is_locked = true AND locked_until > NOW();

-- Increment failed attempts
UPDATE pin_verification_attempts 
SET attempt_count = attempt_count + 1, last_attempted_at = CURRENT_TIMESTAMP
WHERE user_id = $1 AND business_id = $2;
```

---

## Security Features by Authentication Mode

### Email OTP Mode
- Uses `password_change_otps` and `email_otp_logs` tables
- Sends OTP via Brevo email service
- 6-digit code, 10-minute expiration
- User must verify email before transaction

**For:**
- Password changes
- PIN setup
- Bank details updates
- Withdrawals

### SMS OTP Mode
- Uses existing KudiSMS infrastructure
- 6-digit code sent via SMS
- Mobile verification
- Existing implementation in `app/dashboard/finance/withdraw/page.tsx`

**For:**
- Bank details updates
- Withdrawals

### PIN Mode
- PIN stored hashed in `businesses.pin_hash`
- Rate limiting via `pin_verification_attempts`
- 4-6 digit numeric PIN
- Set via `password_change_otps` OTP verification first
- Requires PIN entry for sensitive operations

**For:**
- Bank details updates
- Withdrawals
- Business settings changes

---

## Data Flow Examples

### Password Change Flow
```
1. User requests password change at /dashboard/security
2. System checks current password
3. API generates OTP → password_change_otps table
4. Brevo sends OTP email
5. User enters OTP
6. API verifies against password_change_otps
7. Mark is_verified = true
8. User sets new password
9. Password updated in users table
10. Log entry added to email_otp_logs (purpose: 'password_change')
```

### PIN Setup Flow
```
1. User requests PIN setup
2. PIN Setup Modal appears
3. User confirms via OTP (email)
4. OTP generated → password_change_otps
5. Brevo sends OTP email
6. User enters OTP
7. OTP verified → password_change_otps.is_verified = true
8. User enters new PIN (4-6 digits)
9. PIN hashed with bcryptjs
10. Hash stored in businesses.pin_hash
11. pin_set_at updated in businesses
12. email_otp_logs entry created (purpose: 'pin_setup')
13. auth_mode_change_history entry if mode switched to 'pin'
```

### Auth Mode Change Flow
```
1. User selects new auth mode at /dashboard/security
2. If switching TO PIN: Require OTP verification first
3. If switching FROM PIN: Allow without extra verification
4. Update users.preferred_auth_mode
5. Create entry in auth_mode_change_history
6. Log email/IP/device info in metadata
7. Timestamp recorded in created_at
```

### Bank Details Update with PIN
```
1. User navigates to /dashboard/profile/bank-details
2. User clicks "Update Details"
3. Since auth_mode = 'pin': Show PIN input modal
4. User enters PIN
5. System queries businesses.pin_hash
6. Compare with bcryptjs.compare()
7. Check pin_verification_attempts for lockout
8. If failed: Increment attempt_count
9. If locked: Return error with lockout duration
10. If successful: Reset attempt_count, allow update
11. Create record in pin_verification_attempts
```

---

## Indexes Summary

| Table | Index Name | Columns | Purpose |
|-------|-----------|---------|---------|
| password_change_otps | idx_password_change_otps_user_id | user_id | Fast OTP lookup by user |
| email_otp_logs | idx_email_otp_logs_user_id | (user_id, purpose) | Audit trail queries |
| auth_mode_change_history | idx_auth_mode_change_history_user_id | (user_id, created_at DESC) | Recent changes query |
| pin_verification_attempts | idx_pin_verification_attempts_user_id | (user_id, business_id) | Rate limit checks |

---

## Cleanup Policies

### Auto-Expiration
```sql
-- Remove expired OTPs (daily cleanup job)
DELETE FROM password_change_otps WHERE expires_at < NOW();
DELETE FROM email_otp_logs WHERE expires_at < NOW();

-- Archive old auth history (keep 1 year)
DELETE FROM auth_mode_change_history WHERE created_at < NOW() - INTERVAL '1 year';
```

### Rate Limit Reset
```sql
-- Reset lockout for expired attempts
UPDATE pin_verification_attempts 
SET is_locked = false, attempt_count = 0 
WHERE is_locked = true AND locked_until < NOW();
```

---

## Security Considerations

1. **PIN Storage:** Always use bcryptjs for hashing, never store plaintext
2. **OTP Expiration:** 10-minute window, enforced at database level
3. **Rate Limiting:** 5 attempts before 15-minute lockout on PIN
4. **Audit Trail:** All mode changes logged with IP and user agent
5. **Indexes:** Optimized for common queries to prevent slow operations
6. **Foreign Keys:** Links to users/businesses maintained for data integrity
7. **JSONB Metadata:** Flexible storage for additional security context

---

## Testing Queries

```sql
-- Get all OTPs for a user in last 24 hours
SELECT * FROM password_change_otps 
WHERE user_id = 'user123' AND created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Check if user has PIN set
SELECT pin_hash, pin_set_at FROM businesses 
WHERE owner_id = 'user123' AND pin_hash IS NOT NULL;

-- Get auth mode change history for user
SELECT * FROM auth_mode_change_history 
WHERE user_id = 'user123' ORDER BY created_at DESC;

-- Check PIN lockout status
SELECT * FROM pin_verification_attempts 
WHERE user_id = 'user123' AND business_id = 'biz123';

-- Count unverified OTPs
SELECT COUNT(*) FROM email_otp_logs 
WHERE user_id = 'user123' AND purpose = 'pin_setup' AND status = 'pending';
```
