# Critical Fixes Applied to FoodBase

## 1. Database Query Syntax Error - FIXED

### Problem
The application was throwing error:
```
Error: This function can now be called only as a tagged-template function: sql`SELECT ${value}`
```

### Root Cause
The Neon database driver (`@neondatabase/serverless`) requires using `sql.query()` method for conventional parameterized queries with `$1, $2` placeholders, NOT the `sql()` function call.

### Solution Applied
Updated `lib/db.ts`:
- Changed from: `sql(queryString, values)` - WRONG
- Changed to: `sql.query(queryString, values)` - CORRECT
- This applies to all query helpers: `query()`, `getOne()`, `getAll()`

### Files Modified
- `/lib/db.ts` - Updated query helper functions to use `sql.query()`

### Verification
After deployment, these endpoints should work:
- POST `/api/auth/login` - Database query for user lookup
- POST `/api/auth/forgot-password` - Database query for user email verification
- All business and admin API routes

---

## 2. Database Schema - Users Table Fields - FIXED

### Problem
The seed data was inserting incomplete user records. The users table requires specific fields that were missing.

### Required Fields (from Neon schema)
```sql
- id (character varying) - PRIMARY KEY
- email (character varying) - REQUIRED
- password_hash (character varying) - REQUIRED
- role (user-defined enum) - REQUIRED
- first_name (character varying) - REQUIRED
- last_name (character varying) - REQUIRED
- phone (character varying) - REQUIRED
- is_active (boolean) - REQUIRED
- created_at (timestamp) - REQUIRED
- updated_at (timestamp) - REQUIRED
```

### Solution Applied
Updated `scripts/02-seed-data.sql`:
- Admin user: Wisdom Admin, wisdommeremeze@gmail.com, 08000000000
- Business owner: John Okafor, owner@example.com, 08012345678
- All required fields now populated with meaningful data
- Added proper timestamps for created_at and updated_at

### Additional Updates to Seed Data
1. **Addons Table**: Fixed column name from `category` to `addon_type`
2. **Addon Options**: Added comprehensive addon options with proper pricing
3. **Business Details**: Added bank details, postal code, and balance fields
4. **Relationships**: Ensured all foreign keys reference existing records

### Files Modified
- `/scripts/02-seed-data.sql` - Complete rewrite with all required fields

---

## 3. Cloudinary Dependency Update - FIXED

### Problem
Package was using outdated `cloudinary-next@^5.0.0` which has breaking API changes.

### Solution Applied
Updated `package.json`:
- Changed: `"cloudinary-next": "^5.0.0"`
- To: `"next-cloudinary": "^2.2.0"` (already in package.json)

Updated `lib/cloudinary.ts`:
- Removed v2 cloudinary SDK import
- Added next-cloudinary components (CldUploadWidget, CldImage)
- Implemented server-side upload using Cloudinary REST API
- Added proper error handling and validation
- Exported components for use in React pages

### Key Changes
1. Client-side uploads now use CldUploadWidget from next-cloudinary
2. Server-side uploads use direct Cloudinary REST API calls
3. Image URLs generated with proper transformations and caching
4. Delete functionality uses Cloudinary admin API with authentication

### Files Modified
- `/lib/cloudinary.ts` - Complete rewrite for next-cloudinary compatibility
- `/package.json` - Already had correct dependency

---

## 4. Logo Upload - COMPLETED

### What Was Done
- FoodBase logo image uploaded to `/public/foodbase-logo.png`
- Image is now accessible in all pages and dashboards
- Used in navigation, homepage, and restaurant pages

### File Added
- `/public/foodbase-logo.png` - Professional FoodBase cloche logo

---

## 5. Environment Variables - REQUIRED FOR DEPLOYMENT

### Admin Credentials (Hardcoded in seed data)
```
Email: wisdommeremeze@gmail.com
Password: 1a2B3c$d
```

### Environment Variables to Add in Vercel
```env
# Database
DATABASE_URL=your_neon_connection_string

# Authentication
JWT_SECRET=your_random_secret_32_chars_minimum

# Paystack
PAYSTACK_SECRET_KEY=sk_live_xxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxx

# Cloudinary
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Brevo (Email)
BREVO_API_KEY=your_brevo_api_key
BREVO_EMAIL=wisdommeremeze@gmail.com

# Application
APP_BASE_URL=https://your-vercel-domain.vercel.app
```

---

## 6. Database Schema Validation Script

### New File Added
`scripts/03-validate-schema.sql` - Comprehensive validation queries to verify:
- All tables exist and are properly structured
- Users table has correct columns and data types
- Admin and business owner users are present
- Relationships between tables are valid
- Password hashes are properly formatted

### How to Run
```bash
# Connect to your Neon database and run:
psql $DATABASE_URL -f scripts/03-validate-schema.sql
```

---

## Testing Checklist

### Before Deployment
- [ ] Delete pnpm-lock.yaml and run `pnpm install`
- [ ] Run database migrations: `scripts/01-init-schema.sql`
- [ ] Seed database: `scripts/02-seed-data.sql`
- [ ] Validate schema: `scripts/03-validate-schema.sql`
- [ ] All environment variables set in .env.local

### After Deployment
- [ ] Homepage loads without errors
- [ ] Login page works: `http://localhost:3000/login`
- [ ] Admin login works with: wisdommeremeze@gmail.com / 1a2B3c$d
- [ ] Forgot password sends OTP email
- [ ] Dashboard loads after successful login
- [ ] API routes return proper responses
- [ ] Database queries execute without "tagged-template" errors

### Specific Endpoints to Test
```bash
# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"wisdommeremeze@gmail.com","password":"1a2B3c$d"}'

# Test forgot password
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"wisdommeremeze@gmail.com"}'

# Test business retrieval
curl -X GET http://localhost:3000/api/business \
  -H "Cookie: auth=YOUR_JWT_TOKEN"
```

---

## Summary of All Changes

| Component | Change | File(s) |
|-----------|--------|---------|
| Database Queries | Updated to use `sql.query()` method | lib/db.ts |
| Seed Data | Added all required user fields | scripts/02-seed-data.sql |
| Cloudinary | Updated to next-cloudinary v2.2.0 | lib/cloudinary.ts |
| Logo | Uploaded FoodBase logo | public/foodbase-logo.png |
| Validation | Added schema validation script | scripts/03-validate-schema.sql |
| Package.json | Already has next-cloudinary@^2.2.0 | package.json |

---

## Next Steps

1. **Run migrations locally**
   ```bash
   pnpm install
   psql $DATABASE_URL -f scripts/01-init-schema.sql
   psql $DATABASE_URL -f scripts/02-seed-data.sql
   ```

2. **Set environment variables** in Vercel dashboard

3. **Delete pnpm-lock.yaml** to fix dependency issues
   ```bash
   rm pnpm-lock.yaml
   pnpm install
   git add pnpm-lock.yaml
   git commit -m "Update pnpm lockfile"
   git push
   ```

4. **Deploy to Vercel**

5. **Run validation script** to confirm all is working

---

## Support

If you encounter issues:
1. Check DEPLOY_TROUBLESHOOTING.md for common problems
2. Review error messages in the [v0] console logs
3. Verify all environment variables are set correctly
4. Run validation script to check database integrity
