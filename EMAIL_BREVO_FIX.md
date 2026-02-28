## Email Authentication Fix - Brevo SMTP Configuration

### Problem Identified
Error: `Invalid login: 535 5.7.8 Authentication failed` when attempting to send emails (password reset, notifications)

### Root Cause Analysis
The nodemailer transporter was being initialized at module load time with environment variables. This caused two issues:
1. **Timing Issue**: Environment variables weren't loaded when the transporter initialized
2. **Caching Issue**: The transporter was cached as a module-level constant, so changes to env vars weren't reflected

### Solution Applied

**File Changed:** `/lib/email.ts`

**Changes Made:**
1. **Lazy Initialization**: Refactored to initialize the transporter only when needed (at request time)
2. **Runtime Environment Loading**: Environment variables are now read at runtime via `getTransporter()`
3. **Validation Warnings**: Added console warnings if SMTP credentials are missing
4. **Dynamic From Address**: The "from" field now reads `BREVO_EMAIL` at request time, not at module load

**Code Pattern:**
```typescript
// Before (problematic - initialized once at startup)
const transporter = nodemailer.createTransport({...});

// After (fixed - initialized on first request)
function getTransporter() {
  if (transporter) return transporter;
  const brevoSmtpKey = process.env.BREVO_SMTP_KEY;
  transporter = nodemailer.createTransport({
    auth: {
      user: brevoEmail,
      pass: brevoSmtpKey || '',
    },
  });
  return transporter;
}
```

### What to Do Now

**Step 1: Verify Environment Variables in Vercel**
1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Confirm these are set:
   - `BREVO_SMTP_KEY=xsmtpsib-...` (your Brevo SMTP key)
   - `BREVO_EMAIL=wisdommeremeze@gmail.com`
   - `BREVO_API_KEY=...` (optional fallback)

**Step 2: Redeploy**
```bash
# Push the code changes
git add lib/email.ts
git commit -m "Fix: Lazy-initialize Brevo transporter for proper env var loading"
git push

# Vercel will auto-redeploy
```

**Step 3: Test Password Reset**
1. Go to `/forgot-password`
2. Enter your email address
3. Click "Send Reset Code"
4. Check email for OTP code (should arrive without auth errors)

### Verifying the Fix

**Check that the email config is correct:**
1. BREVO_SMTP_KEY format: Should start with `xsmtpsib-` (NOT just any API key)
2. BREVO_EMAIL: `wisdommeremeze@gmail.com`
3. Port: 587 (TLS)
4. Host: `smtp-relay.brevo.com`

**If still getting auth errors:**
1. Double-check the BREVO_SMTP_KEY value - copy it exactly from Brevo Dashboard
2. Make sure there are no extra spaces or characters in the env var value
3. Try regenerating the SMTP key in Brevo Dashboard and updating it in Vercel
4. Redeploy after updating the env var

### How the Fix Works

The new lazy-initialization pattern ensures:
- Environment variables are loaded at request time (when they're guaranteed to be available)
- The transporter is created fresh with the current env var values
- Each request has access to the latest Brevo credentials
- No caching issues from module-level initialization

This is a common pattern for handling environment variables in serverless environments like Vercel.
