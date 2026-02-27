# Fix Vercel Deployment Error - pnpm-lock.yaml

## Problem
The deployment is failing with this error:
```
ERR_PNPM_OUTDATED_LOCKFILE Cannot install with "frozen-lockfile" because pnpm-lock.yaml is not up to date with package.json
```

This happens because we added new dependencies to `package.json` but the lockfile wasn't updated.

## Solution

### Option 1: Fix Locally and Push (Recommended)

1. **Delete the old lockfile locally:**
   ```bash
   rm pnpm-lock.yaml
   ```

2. **Reinstall dependencies:**
   ```bash
   pnpm install
   ```
   This will generate a new `pnpm-lock.yaml` with all dependencies including the new ones.

3. **Verify the new lockfile includes all new packages:**
   ```bash
   grep -E "bcryptjs|cloudinary-next|jose|nanoid|nodemailer|paystack|qrcode.react|swr|@neondatabase/serverless" pnpm-lock.yaml
   ```
   You should see entries for all these packages.

4. **Commit and push:**
   ```bash
   git add pnpm-lock.yaml package.json
   git commit -m "Update pnpm lockfile with new dependencies"
   git push
   ```

5. **Redeploy on Vercel:**
   - Go to your Vercel dashboard
   - Click **Deployments**
   - Click the three dots on the latest failed deployment
   - Click **Redeploy**

### Option 2: Override in Vercel (Quick Fix)

If you can't regenerate locally, you can tell Vercel to skip the frozen lockfile check:

1. **Go to Vercel Project Settings:**
   - Navigate to your Vercel project
   - Click **Settings**
   - Click **Build & Development Settings**

2. **Scroll to "Install Command":**
   - Change from: `pnpm install --frozen-lockfile`
   - Change to: `pnpm install --no-frozen-lockfile`
   - Click **Save**

3. **Redeploy:**
   - Go to **Deployments**
   - Click **Redeploy** on the latest deployment

**Note:** This is a temporary fix. You should still regenerate the lockfile locally (Option 1) for the next deployment.

## Verifying the Fix

After deployment, you should see:
```
✓ Install command `pnpm install --frozen-lockfile` (or --no-frozen-lockfile)
✓ Dependencies installed successfully
✓ Build complete
```

## Updated Credentials in Database

The seed data has been updated with:
- **Admin Email:** `wisdommeremeze@gmail.com`
- **Admin Password:** `1a2B3c$d` (bcrypt hashed)

After deployment, you can log in with these credentials.

## Next Steps

1. Follow **ENV_SETUP.md** to add all required environment variables to Vercel
2. Set up your Neon, Paystack, Cloudinary, and Brevo accounts
3. Re-deploy with environment variables configured
4. Test the application at your Vercel URL
