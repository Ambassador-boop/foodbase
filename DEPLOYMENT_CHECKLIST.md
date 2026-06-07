# PIN System Deployment Checklist

## Pre-Deployment

### Environment Setup
- [ ] **KUDISMS_TOKEN** - Set in Vercel project environment variables
  - Get from KudiSMS dashboard
  - Format: API token string
  - Test: `curl -X POST https://my.kudisms.net/api/sms -H "Content-Type: application/json" -d '{"token":"YOUR_TOKEN","senderID":"FoodBase","recipients":"2348012345678","message":"Test","gateway":"2"}'`

- [ ] **DATABASE_URL** - Already configured for Neon
  - Verify connection is working
  - Test: `psql $DATABASE_URL -c "SELECT 1"`

### Database Preparation
- [ ] Run migration: `migrations/add-pins-and-kudi-sms.sql`
  - Open Neon dashboard
  - Go to SQL editor
  - Paste entire migration file
  - Execute
  
- [ ] Verify tables created:
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name IN ('pins', 'kudi_sms_balance', 'kudi_sms_logs');
  ```
  Should return 3 rows.

- [ ] Verify schema:
  ```sql
  \d pins
  \d kudi_sms_balance
  \d kudi_sms_logs
  ```

### Dependencies
- [ ] bcryptjs installed: `pnpm list bcryptjs`
  - Should show: `bcryptjs@2.x.x` or higher
  - If missing: `pnpm add bcryptjs @types/bcryptjs`

### Code Review
- [ ] `app/dashboard/profile/bank-details/page.tsx`
  - [ ] Imports: `PinModal`, `usePinVerification`
  - [ ] State: `pinRequired`, `pinVerification` hook
  - [ ] Function: `handleSaveBankDetails()` calls `requestPin()`
  - [ ] Function: `handlePinVerified()` saves to database
  - [ ] JSX: `<PinModal>` component rendered

- [ ] `app/dashboard/finance/withdraw/page.tsx`
  - [ ] Imports: `PinModal`, `usePinVerification`
  - [ ] State: `pinRequired`, `pinVerification` hook
  - [ ] Function: `submit()` calls `requestPin()`
  - [ ] Function: `handlePinVerified()` processes withdrawal
  - [ ] JSX: `<PinModal>` component rendered

- [ ] `lib/pin-utils.ts`
  - [ ] 11 utility functions present
  - [ ] Proper error handling
  - [ ] Phone number formatting logic

- [ ] `app/api/pins/request/route.ts`
  - [ ] POST endpoint working
  - [ ] PIN generation and hashing
  - [ ] SMS sending via KudiSMS
  - [ ] Database storage

- [ ] `app/api/pins/verify/route.ts`
  - [ ] POST endpoint working
  - [ ] PIN verification logic
  - [ ] Expiration checking
  - [ ] PIN deletion after use

---

## Local Testing

### Setup
```bash
# Install dependencies
pnpm install

# Set environment variables
export KUDISMS_TOKEN=your_test_token
export DATABASE_URL=your_neon_url

# Run dev server
pnpm dev
```

### Test Bank Details Flow
1. Navigate to `http://localhost:3000/dashboard/profile/bank-details`
2. Fill form:
   - [ ] Select bank (e.g., "GTBank")
   - [ ] Enter valid account number (e.g., "0123456789")
   - [ ] Click "Verify account"
   - [ ] Account holder name appears
3. Click "Save bank details"
   - [ ] PIN modal appears
   - [ ] Phone number field shows (verify it's correct)
4. Check SMS or logs:
   - [ ] SMS received (if phone number is real)
   - [ ] Or check API logs: `GET /api/kudi-sms/logs`
5. Enter PIN from SMS:
   - [ ] [ ][ ][ ][ ][ ][ ] (6 digits)
   - [ ] Correct PIN: Details saved, success message
   - [ ] Wrong PIN: Error message, can retry
6. Refresh page:
   - [ ] Saved bank details display correctly

### Test Withdrawal Flow
1. Navigate to `http://localhost:3000/dashboard/finance/withdraw`
2. Verify bank details section shows saved account
3. Enter withdrawal amount:
   - [ ] Amount field shows
   - [ ] Min ₦100, Max available balance
   - [ ] Quick chips (25%, 50%, 75%, Max) work
4. Add optional note
5. Click "Confirm withdrawal"
   - [ ] PIN modal appears
   - [ ] SMS includes amount: "Use this to authorize your ₦X,XXX.00 withdrawal"
6. Check SMS:
   - [ ] SMS received with correct amount
   - [ ] Or check API logs: `GET /api/kudi-sms/logs`
7. Enter PIN from SMS:
   - [ ] [ ][ ][ ][ ][ ][ ] (6 digits)
   - [ ] Correct PIN: Withdrawal processed, redirected
   - [ ] Wrong PIN: Error message, can retry
8. Verify withdrawal:
   - [ ] Check withdrawal list shows new transaction
   - [ ] Balance decreased appropriately

### Test Error Cases
- [ ] Try to save without verifying account → Error shown
- [ ] Try to withdraw without bank details → Redirect to setup
- [ ] Try to withdraw more than balance → Error message
- [ ] SMS fails (simulate by using invalid phone) → Error handling
- [ ] Wrong PIN (5 times) → Rate limiting or clear error
- [ ] Wait > 10 minutes before entering PIN → Expiration error

### Test Database
```bash
# Check pins table
psql $DATABASE_URL -c "SELECT id, purpose, expires_at FROM pins ORDER BY created_at DESC LIMIT 5;"

# Check SMS logs
psql $DATABASE_URL -c "SELECT purpose, phone_number, status FROM kudi_sms_logs ORDER BY created_at DESC LIMIT 5;"

# Check balance tracking
psql $DATABASE_URL -c "SELECT balance, last_updated FROM kudi_sms_balance LIMIT 1;"
```

---

## Pre-Production Testing

### Staging Environment
- [ ] Deploy to Vercel staging branch
- [ ] Set KUDISMS_TOKEN in staging env vars
- [ ] Run complete test suite on staging
- [ ] Test with real phone number (if team available)
- [ ] Monitor logs for errors

### Load Testing (Optional)
```bash
# Test PIN request endpoint performance
wrk -t4 -c100 -d30s --script=test.lua http://staging.example.com/api/pins/request

# Test PIN verify endpoint performance
wrk -t4 -c100 -d30s --script=test.lua http://staging.example.com/api/pins/verify
```

### Security Testing
- [ ] Test CORS headers (if applicable)
- [ ] Test authentication (try without credentials)
- [ ] Test authorization (try other user's PINs)
- [ ] Test SQL injection (enter special characters)
- [ ] Test XSS (try script tags in error messages)

---

## Production Deployment

### Final Checks
- [ ] All tests passing locally
- [ ] Code reviewed by team
- [ ] KUDISMS_TOKEN set in production
- [ ] Database migration applied to production
- [ ] Backup created before deployment
- [ ] Rollback plan documented

### Deploy Steps
1. **Code Deployment**
   ```bash
   # Via Vercel CLI or GitHub
   vercel deploy --prod
   ```

2. **Monitor First Hour**
   - [ ] Check error logs: `GET /api/kudi-sms/logs?limit=50`
   - [ ] Monitor SMS balance: `GET /api/kudi-sms/balance`
   - [ ] Check database queries are fast
   - [ ] Monitor user feedback

3. **Initial Transactions**
   - [ ] Have team member test bank save flow
   - [ ] Have team member test withdrawal flow
   - [ ] Verify SMS received successfully
   - [ ] Verify database records created
   - [ ] Check audit logs complete

### Post-Deployment

#### Day 1 Monitoring
- [ ] Check SMS delivery rate (aim: 100%)
- [ ] Check PIN verification success rate (aim: >95%)
- [ ] Monitor error rates in logs
- [ ] Get user feedback on flow
- [ ] Check for any bugs or issues

#### First Week
- [ ] Monitor daily SMS volume
- [ ] Check SMS balance tracking accuracy
- [ ] Review SMS costs vs budgeted
- [ ] Collect user feedback
- [ ] Make any necessary adjustments

#### First Month
- [ ] Analyze PIN verification patterns
- [ ] Monitor for failed verification attempts
- [ ] Review SMS delivery times
- [ ] Calculate cost per transaction
- [ ] Plan for enhancements

---

## Monitoring & Maintenance

### Daily Checks
```bash
# Check SMS balance
curl https://your-domain.com/api/kudi-sms/balance

# Check error rate (example with Sentry/PostHog if integrated)
# Should have <1% error rate
```

### Weekly Checks
```sql
-- SMS volume this week
SELECT DATE(created_at), COUNT(*) FROM kudi_sms_logs 
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at);

-- PIN verification success rate
SELECT 
  purpose,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'success') as successful
FROM kudi_sms_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY purpose;

-- Average response time
SELECT AVG(EXTRACT(EPOCH FROM (expires_at - created_at))) as avg_seconds
FROM pins
WHERE created_at > NOW() - INTERVAL '7 days';
```

### Monthly Checks
```sql
-- SMS cost calculation (₦5.95 per message)
SELECT 
  COUNT(*) * 5.95 as estimated_cost_ngn,
  COUNT(*) as total_sms
FROM kudi_sms_logs
WHERE created_at > NOW() - INTERVAL '30 days';

-- Top errors
SELECT error_code, error_message, COUNT(*) 
FROM kudi_sms_logs
WHERE created_at > NOW() - INTERVAL '30 days'
  AND status = 'failed'
GROUP BY error_code, error_message
ORDER BY COUNT(*) DESC;
```

---

## Rollback Plan

If critical issues arise:

### Immediate Rollback
1. Revert to previous Vercel deployment
2. Remove PIN checks from pages (edit handleSaveBankDetails and submit functions)
3. Users will save/withdraw without PIN verification (temporary)

### Code Changes for Rollback
```typescript
// Temporary: Skip PIN verification
const handleSaveBankDetails = async (e: React.FormEvent) => {
  // Remove PIN requirement, save directly
  setSaving(true);
  // ... existing save logic ...
};
```

### Full Rollback
1. Revert code changes to previous version
2. Disable KudiSMS token in env vars
3. Monitor for issues
4. Plan fix and re-deploy

---

## Support Contacts

- **KudiSMS Support:** support@kudisms.net
- **Neon Support:** support@neon.tech
- **Vercel Support:** support@vercel.com
- **Team Lead:** [contact info]

---

## Troubleshooting During Deployment

### "SMS not sending"
1. Check KUDISMS_TOKEN is set: `echo $KUDISMS_TOKEN`
2. Check balance: `GET /api/kudi-sms/balance`
3. Check logs: `GET /api/kudi-sms/logs?limit=20`
4. Check phone format: Should be international (e.g., 2348012345678)

### "PIN verification failing"
1. Check database migration was applied
2. Check pins table exists: `\d pins`
3. Check expiration: `SELECT NOW() - expires_at FROM pins ORDER BY created_at DESC LIMIT 1;`
4. Check bcryptjs installed: `pnpm list bcryptjs`

### "Database connection errors"
1. Check DATABASE_URL is set
2. Verify Neon database is running
3. Check network connectivity
4. Review Neon logs for errors

### "Modal not appearing"
1. Check component imports
2. Check hook is initialized
3. Check `pinRequired` state is true
4. Check browser console for errors

---

## Success Criteria

Deployment is successful when:
- ✅ PIN modal appears on bank details save
- ✅ PIN modal appears on withdrawal confirm
- ✅ SMS sent successfully to business phone
- ✅ Correct PIN verifies transaction
- ✅ Wrong PIN shows error
- ✅ PINs expire after 10 minutes
- ✅ All database records created properly
- ✅ No error logs in production
- ✅ User feedback is positive
- ✅ SMS delivery rate >99%
- ✅ PIN verification success rate >95%

---

## Questions or Issues?

1. Check `PRODUCTION_INTEGRATION.md` for integration details
2. Check `PIN_SYSTEM_SETUP.md` for technical setup
3. Check `KUDISMS_BALANCE_MONITORING.md` for SMS monitoring
4. Review application logs in Vercel dashboard
5. Contact team lead or support

---

**Status:** Ready for Production Deployment ✅
**Last Updated:** 2024
**Version:** 1.0
