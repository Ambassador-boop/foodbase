# How to Add Environment Variables to Vercel

## Quick Links
- **Vercel Dashboard:** https://vercel.com/dashboard
- **Project Settings:** In your project → Settings → Environment Variables
- **Deployment:** In your project → Deployments

## Step-by-Step Guide

### Step 1: Navigate to Environment Variables in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click on your **FoodBase** project
3. Click **Settings** in the top navigation bar
4. In the left sidebar, click **Environment Variables**

### Step 2: Add Each Variable

For each environment variable below, click "Add New" and:
1. Enter the **Name** (e.g., `DATABASE_URL`)
2. Enter the **Value** (your actual secret/key)
3. Select environments:
   - ✓ Production
   - ✓ Preview
   - ✓ Development
4. Click **Save**

### Step 3: Variables to Add

Copy and paste these names, then get the values from the respective services:

#### 1. **DATABASE_URL**
- **Value from:** Neon Dashboard
- **How to get:**
  1. Go to https://console.neon.tech
  2. Click your project
  3. Click "Connection"
  4. Select "Node.js" driver
  5. Copy the full connection string
- **Example:** `postgresql://user:password@ep-xyz.us-east-1.neon.tech/dbname`

#### 2. **JWT_SECRET**
- **Value from:** Generate randomly
- **How to generate:**
  - Run in your terminal: `openssl rand -base64 32`
  - Or use any online generator
- **Important:** Use a different value for production
- **Min length:** 32 characters

#### 3. **PAYSTACK_SECRET_KEY**
- **Value from:** Paystack Dashboard
- **How to get:**
  1. Go to https://dashboard.paystack.com
  2. Click **Settings** → **API Keys & Webhooks**
  3. Copy **Secret Key** (starts with `sk_test_` or `sk_live_`)
  4. Use `sk_test_` for Preview/Development
  5. Use `sk_live_` for Production

#### 4. **PAYSTACK_PUBLIC_KEY**
- **Value from:** Paystack Dashboard (same place as Secret Key)
- **How to get:**
  1. Same as above
  2. Copy **Public Key** (starts with `pk_test_` or `pk_live_`)

#### 5. **CLOUDINARY_CLOUD_NAME**
- **Value from:** Cloudinary Dashboard
- **How to get:**
  1. Go to https://cloudinary.com/console
  2. Your Cloud Name is displayed at the top
  3. Example: `your-cloud-name`

#### 6. **CLOUDINARY_API_KEY**
- **Value from:** Cloudinary Dashboard
- **How to get:**
  1. Go to https://cloudinary.com/console
  2. Click **Settings** → **API Keys**
  3. Copy the **API Key** (numeric)

#### 7. **CLOUDINARY_API_SECRET**
- **Value from:** Cloudinary Dashboard
- **How to get:**
  1. Same as API Key location
  2. Copy the **API Secret**
- **⚠️ WARNING:** Keep this secret! Never expose in client code.

#### 8. **BREVO_EMAIL**
- **Fixed Value:** `wisdommeremeze@gmail.com`
- Just copy this value as-is

#### 9. **BREVO_API_KEY**
- **Value from:** Brevo Dashboard
- **How to get:**
  1. Go to https://app.brevo.com
  2. Click **SMTP & API** → **SMTP**
  3. Look for **SMTP Password** (this is your API key)
  4. If not available, click "Generate new password"
  5. Example: `xsmtpsib-1a2b3c4d5e6f7g8h9i0j`

#### 10. **APP_BASE_URL**
- **Value from:** Your Vercel deployment URL
- **For Production:**
  - If you have a custom domain: `https://yourdomain.com`
  - Otherwise: `https://foodbase-xxx.vercel.app` (from Vercel dashboard)
- **For Preview/Development:**
  - Can be same as production or `http://localhost:3000` for local testing

---

## Environment Variables Summary Table

| Variable | Example Value | Service | Environment |
|----------|---------------|---------|-------------|
| `DATABASE_URL` | `postgresql://...` | Neon | Prod, Preview, Dev |
| `JWT_SECRET` | `randomsecret32chars...` | Generate | Prod, Preview, Dev |
| `PAYSTACK_SECRET_KEY` | `sk_live_xxx` | Paystack | Prod, Preview, Dev |
| `PAYSTACK_PUBLIC_KEY` | `pk_live_xxx` | Paystack | Prod, Preview, Dev |
| `CLOUDINARY_CLOUD_NAME` | `your-cloud` | Cloudinary | Prod, Preview, Dev |
| `CLOUDINARY_API_KEY` | `123456789` | Cloudinary | Prod, Preview, Dev |
| `CLOUDINARY_API_SECRET` | `abc123def456` | Cloudinary | Prod, Preview, Dev |
| `BREVO_EMAIL` | `wisdommeremeze@gmail.com` | Fixed | Prod, Preview, Dev |
| `BREVO_API_KEY` | `xsmtpsib-xxx` | Brevo | Prod, Preview, Dev |
| `APP_BASE_URL` | `https://foodbase.vercel.app` | Vercel | Prod, Preview, Dev |

---

## After Adding Variables

### 1. Redeploy the Application

1. Go to **Deployments** tab in your Vercel project
2. Find the latest deployment (might be the failed one)
3. Click the **three dots (...)** on the right
4. Click **Redeploy**
5. Wait for the deployment to complete

### 2. Verify Deployment Success

You should see:
- ✓ Build phase successful
- ✓ Deployment complete
- ✓ No errors in logs

### 3. Test the Application

Visit your Vercel URL and test:
1. **Homepage:** Works and loads correctly
2. **Login:** Use credentials:
   - Email: `wisdommeremeze@gmail.com`
   - Password: `1a2B3c$d`
3. **Forgot Password:** Should send OTP to email
4. **Business Dashboard:** Should load metrics
5. **Public Restaurant Page:** Should display menu
6. **Checkout:** Should initialize Paystack payment

---

## Troubleshooting

### "Build failed" after adding variables
- **Check:** All variable names are spelled exactly as listed above
- **Check:** No extra spaces in values
- **Check:** Long strings are complete (not truncated)
- **Fix:** Click **Redeploy** after verifying

### "Database connection refused"
- **Check:** DATABASE_URL is correct from Neon
- **Check:** IP whitelist in Neon includes Vercel IPs
- **Fix:** Add `0.0.0.0/0` to IP whitelist (less secure) or Vercel's IPs

### "Email not sending"
- **Check:** BREVO_EMAIL is `wisdommeremeze@gmail.com`
- **Check:** BREVO_API_KEY is correct from Brevo SMTP
- **Fix:** Regenerate new SMTP password in Brevo

### "Payment not working"
- **Check:** Using correct Paystack keys (test vs live)
- **Check:** PAYSTACK_SECRET_KEY and PUBLIC_KEY match
- **Fix:** Webhook might need configuration in Paystack dashboard

---

## Different Keys for Each Environment

### For Development/Preview
Use **Test** keys:
```
PAYSTACK_SECRET_KEY=sk_test_xxx
PAYSTACK_PUBLIC_KEY=pk_test_xxx
JWT_SECRET=dev-secret-32-chars
DATABASE_URL=test-database-url
```

### For Production
Use **Live** keys:
```
PAYSTACK_SECRET_KEY=sk_live_xxx
PAYSTACK_PUBLIC_KEY=pk_live_xxx
JWT_SECRET=production-secret-32-chars
DATABASE_URL=production-database-url
```

To set different values per environment in Vercel:
1. When adding a variable, **uncheck** the environments you don't want
2. Click **Save**
3. Add the same variable again with different value for other environment
4. Select only that environment

---

## Security Best Practices

✓ **DO:**
- Use strong JWT_SECRET (32+ chars, random)
- Keep API secrets confidential
- Use different keys for test vs production
- Rotate keys periodically
- Monitor Paystack transactions

✗ **DON'T:**
- Commit .env files to git
- Share API secrets in chat/email
- Use production keys for testing
- Expose CLOUDINARY_API_SECRET in client code
- Log sensitive values

---

## Support

If you encounter issues:
1. Check this guide again
2. Review the specific service documentation (links below)
3. Check Vercel deployment logs
4. Contact support for your respective service

**Service Documentation:**
- [Neon Docs](https://neon.tech/docs)
- [Paystack Docs](https://paystack.com/docs)
- [Cloudinary Docs](https://cloudinary.com/documentation)
- [Brevo SMTP Docs](https://help.brevo.com/hc/en-us/articles/209467485)
- [Vercel Docs](https://vercel.com/docs)
