# FoodBase Environment Variables Setup Guide

This guide shows you where to add all required environment variables for FoodBase to function properly.

## Where to Add Environment Variables

### Local Development
Create a `.env.local` file in the root directory of your project:
```
# .env.local
DATABASE_URL=your_neon_database_url
JWT_SECRET=your_jwt_secret_key
PAYSTACK_SECRET_KEY=your_paystack_secret
PAYSTACK_PUBLIC_KEY=your_paystack_public
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_key
CLOUDINARY_API_SECRET=your_cloudinary_secret
BREVO_EMAIL=wisdommeremeze@gmail.com
BREVO_API_KEY=your_brevo_api_key
APP_BASE_URL=http://localhost:3000
```

### Vercel Deployment
Go to your Vercel Project Settings:
1. Navigate to **Settings** → **Environment Variables**
2. Add each variable below with its corresponding value
3. Make sure to set them for all environments (Production, Preview, Development)

## Required Environment Variables

### 1. Database Configuration
**Variable Name:** `DATABASE_URL`
**Description:** Connection string for Neon PostgreSQL database
**Example:** `postgresql://user:password@ep-xyz.us-east-1.neon.tech/dbname`
**Where to Get:** 
- Go to Neon Dashboard → Your Project
- Copy the connection string from the "Connection" tab
- Select "Node.js" as the driver type

### 2. JWT Authentication
**Variable Name:** `JWT_SECRET`
**Description:** Secret key for signing JWT tokens (must be strong, at least 32 characters)
**Example:** `your-super-secret-jwt-key-min-32-chars-recommended`
**How to Generate:** Use `openssl rand -base64 32` or any secure random generator

### 3. Paystack Payment Gateway

#### Secret Key
**Variable Name:** `PAYSTACK_SECRET_KEY`
**Description:** Your Paystack secret API key for server-side payment verification
**Where to Get:**
1. Log in to [Paystack Dashboard](https://dashboard.paystack.com)
2. Go to **Settings** → **API Keys & Webhooks**
3. Copy the **Secret Key** (starts with `sk_live_` or `sk_test_`)

#### Public Key
**Variable Name:** `PAYSTACK_PUBLIC_KEY`
**Description:** Your Paystack public API key for client-side payment initialization
**Where to Get:**
1. Same location as Secret Key
2. Copy the **Public Key** (starts with `pk_live_` or `pk_test_`)

**Note:** 
- Use `pk_test_` and `sk_test_` for testing
- Use `pk_live_` and `sk_live_` for production

### 4. Cloudinary Image Management

#### Cloud Name
**Variable Name:** `CLOUDINARY_CLOUD_NAME`
**Description:** Your Cloudinary cloud identifier
**Where to Get:**
1. Log in to [Cloudinary Dashboard](https://cloudinary.com/console)
2. Your Cloud Name is displayed at the top of the dashboard
3. Example: `your-cloud-name`

#### API Key
**Variable Name:** `CLOUDINARY_API_KEY`
**Description:** API key for authenticated uploads
**Where to Get:**
1. Go to **Settings** → **API Keys**
2. Copy the **API Key** value
3. Example: `123456789012345`

#### API Secret
**Variable Name:** `CLOUDINARY_API_SECRET`
**Description:** API secret for signing upload requests (keep confidential)
**Where to Get:**
1. Same location as API Key
2. Copy the **API Secret** value
3. Example: `abc123def456ghi789jkl012`

**Warning:** Never commit `CLOUDINARY_API_SECRET` to version control!

### 5. Brevo Email Service (SMTP)

#### Email Address
**Variable Name:** `BREVO_EMAIL`
**Value:** `wisdommeremeze@gmail.com`
**Description:** Sender email address for all transactional emails (OTP, notifications)

#### API Key
**Variable Name:** `BREVO_API_KEY`
**Description:** SMTP password for authenticating with Brevo/Sendinblue
**Where to Get:**
1. Log in to [Brevo Dashboard](https://app.brevo.com)
2. Go to **SMTP & API** → **SMTP**
3. Copy the **SMTP password** (or generate a new one)
4. Example: `xsmtpsib-1a2b3c4d5e6f7g8h9i0j`

**SMTP Configuration:**
- Host: `smtp-relay.brevo.com`
- Port: `587`
- Username: `wisdommeremeze@gmail.com`
- Password: (Use the API Key above)

### 6. Application Configuration
**Variable Name:** `APP_BASE_URL`
**Description:** Base URL of your deployed application
**Examples:**
- Local: `http://localhost:3000`
- Production: `https://foodbase.yourcompany.com`
**Used For:** QR code generation, redirect URLs, webhook callbacks

## Step-by-Step Setup Instructions

### For Local Development

1. **Create `.env.local` file:**
   ```bash
   touch .env.local
   ```

2. **Add all variables:**
   ```
   DATABASE_URL=postgresql://...
   JWT_SECRET=your-32-char-secret
   PAYSTACK_SECRET_KEY=sk_test_xxx
   PAYSTACK_PUBLIC_KEY=pk_test_xxx
   CLOUDINARY_CLOUD_NAME=your-cloud
   CLOUDINARY_API_KEY=123456789
   CLOUDINARY_API_SECRET=your-secret
   BREVO_EMAIL=wisdommeremeze@gmail.com
   BREVO_API_KEY=xsmtpsib-xxx
   APP_BASE_URL=http://localhost:3000
   ```

3. **Restart development server:**
   ```bash
   pnpm dev
   ```

### For Vercel Production Deployment

1. **Go to Vercel Project Settings:**
   - Navigate to your project in Vercel
   - Click **Settings** in the top navigation

2. **Add Environment Variables:**
   - Click **Environment Variables** in the left sidebar
   - Add each variable one by one
   - For each variable:
     - Enter the name (e.g., `DATABASE_URL`)
     - Enter the value
     - Select which environments: Production, Preview, Development
     - Click "Save"

3. **Redeploy:**
   - After adding all variables, go to **Deployments**
   - Click the three dots next to the latest deployment
   - Select **Redeploy**

4. **Verify Deployment:**
   - Wait for the deployment to complete
   - Visit your application URL
   - Test login and payment flow

## Testing Your Configuration

### 1. Database Connection
```bash
# Test Neon connection in your application
# Try logging in with admin credentials:
# Email: wisdommeremeze@gmail.com
# Password: 1a2B3c$d
```

### 2. Email Service
- Trigger "Forgot Password" on login page
- Check email for OTP code
- Verify email arrives from `wisdommeremeze@gmail.com`

### 3. Cloudinary Upload
- Log in to Business Owner Dashboard
- Go to Menu Management
- Try uploading a menu item image
- Verify image appears correctly

### 4. Paystack Payment
- Visit a public restaurant page
- Complete an order
- Test payment with Paystack test card: `4111111111111111`
- Verify payment success page displays

## Security Best Practices

1. **Never share secret keys** - Don't commit `.env.local` to git
2. **Use strong JWT_SECRET** - At least 32 characters, random
3. **Keep API secrets confidential** - Don't expose in client-side code
4. **Rotate keys periodically** - Especially after staff changes
5. **Use separate test/production keys** - Keep test and live APIs isolated
6. **Monitor Paystack** - Check transaction logs in Paystack dashboard
7. **Whitelist Webhook IPs** - If applicable, restrict Paystack webhooks

## Troubleshooting

### "Database connection failed"
- Verify `DATABASE_URL` is correct
- Check if Neon database is running
- Ensure IP whitelist includes your server

### "Brevo email not sending"
- Verify `BREVO_EMAIL` and `BREVO_API_KEY` are correct
- Check Brevo SMTP settings (port 587)
- Verify sender email is approved in Brevo

### "Cloudinary upload fails"
- Verify cloud name, API key, and secret
- Check upload preset is configured
- Ensure you have storage quota remaining

### "Paystack payment not working"
- Verify you're using test keys for development
- Check Paystack webhook configuration
- Ensure `APP_BASE_URL` is correct in webhook settings

## Additional Resources

- [Neon Documentation](https://neon.tech/docs)
- [Paystack Developer Docs](https://paystack.com/docs)
- [Cloudinary Documentation](https://cloudinary.com/documentation)
- [Brevo SMTP Guide](https://help.brevo.com/hc/en-us/articles/209467485-Configure-SMTP)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Vercel Environment Variables](https://vercel.com/docs/projects/environment-variables)
