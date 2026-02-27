# FoodBase - Multi-Tenant Restaurant Ordering SaaS - Setup Guide

## Overview
FoodBase is a professional, highly-optimized restaurant ordering platform built with Next.js 16, Neon PostgreSQL, Paystack, Cloudinary, and Brevo. It features path-based multi-tenant routing, role-based access control, and a compact, mobile-first UI design.

## Technology Stack
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4
- **Backend**: Next.js API Routes
- **Database**: Neon PostgreSQL with alphanumeric IDs
- **Payments**: Paystack
- **Images**: Cloudinary
- **Email**: Brevo (OTP, password reset)
- **Authentication**: JWT + bcrypt

## Prerequisites
1. Node.js 18+ and pnpm
2. Neon PostgreSQL account
3. Paystack account (test and live keys)
4. Cloudinary account
5. Brevo account for email services

## Installation Steps

### 1. Environment Setup
```bash
cp .env.local.example .env.local
```

Fill in all environment variables:
- `DATABASE_URL` - Neon connection string
- `JWT_SECRET` - Generate a secure secret
- `BREVO_API_KEY` - From Brevo dashboard
- `PAYSTACK_PUBLIC_KEY` - Test key from Paystack
- `PAYSTACK_SECRET_KEY` - Test secret from Paystack
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`

### 2. Install Dependencies
```bash
pnpm install
```

### 3. Initialize Database
```bash
# Run the migration script
psql $DATABASE_URL < scripts/01-init-schema.sql

# Seed test data (optional)
psql $DATABASE_URL < scripts/02-seed-data.sql
```

### 4. Start Development Server
```bash
pnpm dev
```

Visit `http://localhost:3000`

## Project Structure

```
/app
  /api
    /auth - Login, password reset, logout
    /admin - Business registration, admin dashboard APIs
    /business - Menu, orders, finance APIs
    /restaurants - Public restaurant menu APIs
    /payments - Paystack integration
  /dashboard - Business owner dashboard (protected)
    /menu - Menu item management
    /addons - Add-ons management
    /categories - Category management
    /drinks - Drinks management
    /orders - Order management
    /finance - Financial dashboard
    /popular - Popular dishes management
    /share - Business sharing & QR code
  /admin - Admin dashboard (protected)
    /businesses - Business management
    /withdrawals - Withdrawal management
    /users - User management
    /settings - Admin settings
  /[slug] - Public restaurant pages
    /checkout - Customer checkout
    /receipt - Order receipt

/lib
  /db.ts - Database connection utilities
  /auth.ts - JWT and password utilities
  /email.ts - Brevo email service
  /paystack.ts - Paystack integration
  /cloudinary.ts - Image upload/management
  /types.ts - TypeScript interfaces
  /utils-extended.ts - Helper functions

/components
  /item-config-modal.tsx - Addon selection for orders
  /ui - shadcn/ui components
```

## Key Features

### Authentication & Authorization
- JWT-based session management
- Role-based access control (Admin, Business Owner)
- OTP password reset via Brevo
- Admin-only business registration

### Business Owner Dashboard
- **General**: High-level metrics (orders, revenue, balance, pending withdrawals)
- **Menu Management**: Create/edit main dishes, organize by category
- **Add-ons**: Define proteins, sides, toppings, extras
- **Drinks**: Separate drink management
- **Categories**: Organize menu items
- **Popular Dishes**: Auto-calculated (10+ orders) or manually featured with images
- **Orders**: Real-time incoming orders with detailed breakdowns
- **Finance**: Revenue tracking, withdrawal management, transaction history
- **Share Business**: Generate QR code linking to `/[restaurant_slug]`

### Admin Dashboard
- **Businesses**: View/manage all registered restaurants
- **Withdrawals**: Monitor withdrawal requests
- **Users**: Manage admins and business owners
- **Settings**: System configuration

### Public Restaurant Pages
- `/[slug]` - Restaurant menu with categories and popular dishes slideshow
- `/[slug]/checkout` - Customer cart and Paystack payment
- `/[slug]/receipt` - Order confirmation and receipt

### Payment Processing
- Secure Paystack integration
- Automatic fund settlement to business accounts
- Withdrawal eligibility: next business day (Monday if weekend)
- Transaction tracking and reporting

## Database Schema Highlights

All IDs are alphanumeric (`nanoid`) for security and scalability:
- Users: `usr_xxx`, `adm_xxx`
- Businesses: `biz_xxx`
- Menu Items: `itm_xxx`
- Orders: `ord_xxx`
- Transactions: `txn_xxx`
- Withdrawals: `wd_xxx`

Key tables:
- `users` - Admin and Business Owner accounts
- `businesses` - Restaurant profiles with bank details
- `menu_items` - Dishes and their details
- `categories` - Menu organization
- `addons` - Customizable extras (proteins, sides, etc.)
- `orders` - Customer orders with status tracking
- `order_items` - Individual items in orders
- `transactions` - Payment and fund records
- `withdrawals` - Withdrawal requests with approval tracking
- `popular_dishes` - Auto and manually featured items

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/forgot-password` - Request OTP
- `POST /api/auth/reset-password` - Reset with OTP
- `POST /api/auth/logout` - Logout

### Business Owner APIs
- `GET /api/business` - Get current business
- `GET/POST /api/business/menu-items` - Menu management
- `GET/POST /api/business/addons` - Add-ons management
- `GET/POST /api/business/categories` - Categories
- `GET /api/business/orders` - View orders
- `GET /api/business/transactions` - Transaction history
- `POST /api/business/withdrawals` - Request withdrawal
- `GET/POST /api/business/bank-details` - Bank account info

### Admin APIs
- `POST /api/admin/businesses/register` - Register new business
- `GET /api/admin/businesses` - List all businesses

### Public APIs
- `GET /api/restaurants/[slug]/menu` - Get restaurant menu

### Payment APIs
- `POST /api/payments/initialize` - Start Paystack payment
- `POST /api/payments/verify` - Verify payment success
- `POST /api/payments/webhook` - Paystack webhook handler

## UI Design System

**Color Palette** (from FoodBase logo):
- Primary: Gold/Olive (#8B7500)
- Accent: Green (#6B9B6B)
- Background: Off-white (#FAFAF8)
- Foreground: Near-black (#1A1A1A)
- Muted: Gray (#8A8A8A)

**Typography**:
- Compact, minimal, text-dense
- Small font sizes for mobile optimization
- Tight spacing throughout
- No card-based layout (flat design)
- Mobile-first responsive approach

## Deployment to Vercel

```bash
# Connect Git repository
vercel link

# Add environment variables in Vercel dashboard
vercel env add DATABASE_URL
vercel env add JWT_SECRET
# ... add remaining env vars

# Deploy
vercel deploy --prod
```

## Testing Credentials (Development)
- Admin email: `admin@foodbase.app`
- Owner email: `owner@example.com`
- Password: Use standard bcrypt hash (check database)

## Important Notes

1. **Multi-Tenancy**: All restaurant data is strictly separated using `business_id`. Never bypass this filter.
2. **Security**: Always verify JWT tokens and business ownership in API routes.
3. **Images**: Use Cloudinary for all images. Never commit images to repo.
4. **Payments**: Test with Paystack test keys before going live.
5. **Bank Details**: Validate bank information server-side before storing.
6. **Withdrawals**: Implement business day calculation for availability.

## Troubleshooting

### Database Connection Issues
- Verify Neon connection string format
- Check network access in Neon dashboard
- Ensure all required extensions are enabled

### Paystack Integration
- Verify API keys match your Paystack environment
- Check webhook signature validation
- Test with Paystack test mode credentials

### Email/OTP Issues
- Verify Brevo API key is active
- Check sender email is verified in Brevo
- Review rate limiting on OTP requests

## Support & Resources
- Vercel Documentation: https://vercel.com/docs
- Next.js Docs: https://nextjs.org
- Neon Docs: https://neon.tech/docs
- Paystack Docs: https://paystack.com/docs
- Cloudinary Docs: https://cloudinary.com/documentation
