# FoodBase - Quick Start Guide

Get FoodBase running in 5 minutes.

## Prerequisites
- Node.js 18+, pnpm
- Neon database account
- Paystack test keys
- Cloudinary account
- Brevo API key

## 1. Install & Setup (2 min)
```bash
# Install dependencies
pnpm install

# Copy environment variables
cp .env.local.example .env.local

# Edit .env.local with your credentials
```

## 2. Database Setup (1 min)
```bash
# Run migration
psql $DATABASE_URL < scripts/01-init-schema.sql

# Seed test data (optional)
psql $DATABASE_URL < scripts/02-seed-data.sql
```

## 3. Start Development Server (1 min)
```bash
pnpm dev
```

## 4. Test Login (1 min)

**Admin Account**:
- Email: `admin@foodbase.app`
- Password: `password` (set in database seed)
- URL: `http://localhost:3000/login` → `/admin`

**Business Owner Account**:
- Email: `owner@example.com`
- Password: `password` (set in database seed)
- URL: `http://localhost:3000/login` → `/dashboard`

**Customer**:
- URL: `http://localhost:3000/the-golden-fork` (if seeded)
- View menu, select items with addons, checkout

---

## Key Features to Try

### As Business Owner (`/dashboard`)
1. **Menu Management** - Create dishes, upload images
2. **Add-ons** - Define proteins, sides, toppings
3. **Orders** - View incoming customer orders in real-time
4. **Finance** - Check revenue, submit withdrawals
5. **Share Business** - Generate QR code for customers

### As Admin (`/admin`)
1. **Businesses** - View all registered restaurants
2. **Register Business** - Add new restaurant (top button)
3. **Withdrawals** - Monitor withdrawal requests
4. **Users** - Manage platform users

### As Customer (`/[slug]`)
1. Browse menu by category
2. Select main dish → See add-ons modal
3. Choose proteins, sides, extras
4. Add to cart with quantity
5. Proceed to checkout
6. Complete Paystack payment (test mode)
7. View order receipt

---

## API Testing

### Quick Test with cURL
```bash
# Login to get token
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@example.com","password":"password"}' \
  | jq -r '.token')

# Get business info
curl http://localhost:3000/api/business \
  -H "Authorization: Bearer $TOKEN"
```

---

## Environment Variables Checklist

```
✓ DATABASE_URL - Neon connection string
✓ JWT_SECRET - Any secure random string
✓ BREVO_API_KEY - From Brevo dashboard
✓ PAYSTACK_PUBLIC_KEY - From Paystack (test)
✓ PAYSTACK_SECRET_KEY - From Paystack (test)
✓ CLOUDINARY_CLOUD_NAME - Your cloud name
✓ CLOUDINARY_API_KEY - Cloudinary API key
✓ CLOUDINARY_API_SECRET - Cloudinary secret
✓ NEXT_PUBLIC_APP_URL - http://localhost:3000
```

---

## Common Issues

### Database Connection Error
```
Check: psql connection string format
psql postgresql://username:password@host/dbname
```

### Paystack/Cloudinary Not Working
```
Verify: env vars are set correctly
pnpm dev stops and restarts to pick up env changes
```

### OTP Not Sending
```
Check: BREVO_API_KEY is valid
Verify: Sender email is verified in Brevo
```

---

## File Structure Overview
```
/app              - Pages and API routes
/lib              - Utilities (DB, auth, email, etc.)
/components       - React components
/scripts          - Database migrations
/public           - Static assets & images
.env.local        - Environment variables
```

---

## Next Steps

1. **Customize Branding** - Replace FoodBase logo in `/public`
2. **Setup Payments** - Use Paystack live keys when ready
3. **Configure Email** - Update Brevo templates
4. **Deploy** - Push to Vercel
5. **Go Live** - Switch to production keys

---

## Support
- See `SETUP.md` for detailed setup
- See `PROJECT_SUMMARY.md` for complete feature overview
- See `API_EXAMPLES.md` for API reference

Happy building! 🚀
