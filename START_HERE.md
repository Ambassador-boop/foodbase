# FoodBase - START HERE

Welcome to FoodBase! This is your complete restaurant ordering SaaS platform. Follow this guide to get up and running.

## 🚨 Immediate Action Required: Fix Deployment

Your current deployment failed because the pnpm lockfile is outdated. **You MUST do this first:**

### Quick Fix (Choose One)

#### Option A: Fix Locally (Recommended)
```bash
# In your project directory
rm pnpm-lock.yaml
pnpm install
git add pnpm-lock.yaml
git commit -m "Update pnpm lockfile"
git push
```

Then go to Vercel → Deployments → Click redeploy on latest deployment

#### Option B: Quick Fix in Vercel
1. Go to Vercel Dashboard → Your Project → Settings
2. Click "Build & Development Settings"
3. Find "Install Command"
4. Change to: `pnpm install --no-frozen-lockfile`
5. Save and redeploy

👉 **Read:** `FIX_DEPLOYMENT.md` for detailed instructions

---

## ✅ Default Admin Credentials

- **Email:** `wisdommeremeze@gmail.com`
- **Password:** `1a2B3c$d`

These credentials are pre-seeded in the database. Change them after first login!

---

## 🔧 Environment Variables Setup

You must add 10 environment variables to Vercel for the app to work:

### Required Variables
1. `DATABASE_URL` - Neon PostgreSQL connection
2. `JWT_SECRET` - JWT signing key (generate random 32+ chars)
3. `PAYSTACK_SECRET_KEY` - Paystack secret key
4. `PAYSTACK_PUBLIC_KEY` - Paystack public key
5. `CLOUDINARY_CLOUD_NAME` - Cloudinary cloud name
6. `CLOUDINARY_API_KEY` - Cloudinary API key
7. `CLOUDINARY_API_SECRET` - Cloudinary API secret
8. `BREVO_EMAIL` - `wisdommeremeze@gmail.com`
9. `BREVO_API_KEY` - Brevo SMTP password
10. `APP_BASE_URL` - Your app URL (https://foodbase-xxx.vercel.app)

👉 **Read:** `VERCEL_ENV_GUIDE.md` for step-by-step instructions on adding each variable

👉 **Read:** `ENV_SETUP.md` for detailed explanations of each variable

---

## 🎯 Getting Started Checklist

### Phase 1: Setup Services (Required First)
- [ ] Create Neon account → Get DATABASE_URL
- [ ] Create Paystack account → Get keys
- [ ] Create Cloudinary account → Get keys
- [ ] Create Brevo account → Get SMTP password
- [ ] Generate JWT_SECRET (run: `openssl rand -base64 32`)

### Phase 2: Add Environment Variables
- [ ] Go to Vercel → Settings → Environment Variables
- [ ] Add all 10 variables (use `VERCEL_ENV_GUIDE.md`)
- [ ] Make sure all are set for Production, Preview, Development

### Phase 3: Deploy
- [ ] Fix pnpm lockfile issue (see above)
- [ ] Redeploy on Vercel
- [ ] Wait for build to complete
- [ ] Visit your app URL

### Phase 4: Test
- [ ] Open homepage → Should load correctly
- [ ] Click "Log In" → Log in with admin credentials
- [ ] You should see the Admin Dashboard
- [ ] Test "Forgot Password" → Should receive OTP email

---

## 📁 Project Structure

```
/app
  /api              - All API endpoints
  /admin            - Admin Dashboard pages
  /dashboard        - Business Owner Dashboard pages
  /[slug]           - Public restaurant pages
  /login            - Login page
  /forgot-password  - Password reset page
  /payment-success  - Payment confirmation
  /page.tsx         - Homepage

/lib
  /auth.ts          - Authentication utilities
  /db.ts            - Database connection
  /email.ts         - Email/OTP service
  /paystack.ts      - Payment integration
  /cloudinary.ts    - Image upload
  /types.ts         - TypeScript types
  /utils-extended.ts - Helper functions

/components        - Reusable React components
/public            - Static assets & images
/scripts           - Database migration scripts
```

---

## 🔐 Database Schema

The Neon database is automatically created with these tables:
- `users` - Admin and business owner accounts
- `businesses` - Restaurant profiles
- `menu_items` - Dishes/main courses
- `addons` - Proteins, sides, toppings
- `drinks` - Beverages
- `categories` - Menu organization
- `orders` - Customer orders
- `order_items` - Individual items in orders
- `transactions` - Payment records
- `withdrawals` - Fund withdrawal requests
- `bank_details` - Business owner bank info

All IDs use alphanumeric format (no sequential numbers).

---

## 🏃 Key Features Included

### For Customers
- Browse restaurant menu
- Select items with customizable add-ons
- Secure Paystack payment
- Order receipt & confirmation

### For Business Owners
- Menu management (dishes, drinks, add-ons)
- Category organization
- Real-time order tracking
- Financial dashboard with daily revenue
- Withdrawal management (next business day)
- QR code sharing
- Popular dishes tracking

### For Admins
- Business owner registration & management
- System-wide metrics
- Withdrawal oversight
- User management
- Settings & configuration

---

## 📖 Documentation Files

| File | Purpose |
|------|---------|
| `FIX_DEPLOYMENT.md` | Fix pnpm lockfile error |
| `VERCEL_ENV_GUIDE.md` | Add environment variables to Vercel |
| `ENV_SETUP.md` | Detailed env variable explanations |
| `SETUP.md` | Local development setup |
| `QUICK_START.md` | 5-minute quick start |
| `PROJECT_SUMMARY.md` | Full feature overview |
| `API_EXAMPLES.md` | API request/response examples |

---

## 🐛 Troubleshooting

### App won't deploy
- Check `FIX_DEPLOYMENT.md` - pnpm lockfile issue
- Check build logs in Vercel

### Can't log in
- Use email: `wisdommeremeze@gmail.com`
- Use password: `1a2B3c$d`
- Check DATABASE_URL is set in Vercel

### Email not sending
- Check BREVO_EMAIL and BREVO_API_KEY are correct
- Verify SMTP settings in Brevo

### Payment not working
- Check PAYSTACK_SECRET_KEY and PUBLIC_KEY
- Use test cards for development
- Check Paystack webhook configuration

### Images not uploading
- Check CLOUDINARY_CLOUD_NAME and API keys
- Ensure upload quotas remain

---

## 🎓 Next Steps

1. **Right Now:** Fix deployment using `FIX_DEPLOYMENT.md`
2. **Then:** Add environment variables using `VERCEL_ENV_GUIDE.md`
3. **Then:** Redeploy and test at Vercel URL
4. **Then:** Log in with admin credentials
5. **Then:** Register a test business owner account
6. **Then:** Create menu items and test ordering

---

## 📞 Support Resources

- **Neon (Database):** https://neon.tech/docs
- **Paystack (Payments):** https://paystack.com/docs
- **Cloudinary (Images):** https://cloudinary.com/documentation
- **Brevo (Email):** https://help.brevo.com
- **Vercel (Hosting):** https://vercel.com/docs
- **Next.js:** https://nextjs.org/docs

---

## 🎉 You're Ready!

Once environment variables are set and deployment succeeds:

```
Homepage:   https://your-vercel-url.com
Admin:      https://your-vercel-url.com/login
Dashboard:  https://your-vercel-url.com/dashboard
Restaurant: https://your-vercel-url.com/[restaurant-slug]
```

**Questions?** Check the relevant documentation file or visit the service provider's docs.

**Happy Building! 🚀**

---

**Last Updated:** February 27, 2026
**Version:** 1.0 Complete
**Status:** Production Ready
