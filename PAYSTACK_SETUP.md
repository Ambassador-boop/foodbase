# Paystack Integration Setup Guide

## Overview
This application uses Paystack for payment processing. Follow these steps to configure Paystack webhooks for production.

## Paystack Webhook URLs

After deployment to Vercel, add these URLs to your Paystack dashboard:

### Live Webhook URL (for receiving payment notifications)
```
https://[YOUR_DOMAIN].com/api/payments/webhook
```

Replace `[YOUR_DOMAIN]` with your actual domain (e.g., `myapp.vercel.app`)

### Live Callback URL (for redirecting customers after payment)
```
https://[YOUR_DOMAIN].com/payment-success
```

## How to Add Webhooks to Paystack Dashboard

1. Go to [Paystack Dashboard](https://dashboard.paystack.com)
2. Click on **Settings** → **API Keys & Webhooks**
3. Under **Webhooks**, click **Add Webhook**
4. For the webhook URL, enter: `https://[YOUR_DOMAIN].com/api/payments/webhook`
5. Select all events or at minimum:
   - `charge.success`
   - `charge.failed`
6. Click **Add Webhook**
7. Copy the webhook signing secret (if shown)

## Environment Variables

Make sure these are set in your Vercel project settings:

```
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxx  # Your live secret key
PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxx   # Your live public key
APP_BASE_URL=https://[YOUR_DOMAIN].com     # Your app's base URL
```

## How It Works

### Payment Flow

1. **Customer adds items to cart** → Goes to checkout
2. **Customer fills delivery info** → Selects delivery type (at restaurant or delivery)
3. **Payment initialization** → `/api/payments/initialize` called with:
   - Amount (in kobo - minimum unit)
   - Customer email (business owner's email)
   - Order ID
   - Reference number

4. **Paystack redirect** → Customer redirected to Paystack payment page
5. **Payment processing** → Customer enters card/bank details
6. **Webhook notification** → Paystack sends `charge.success` event to `/api/payments/webhook`
7. **Order confirmation** → Order status updated to "confirmed" in database
8. **Success page** → Customer redirected to success page

### Amount Conversion

Amounts in the app are stored in Naira (₦) but sent to Paystack in **Kobo** (smallest unit):
- 1 Naira = 100 Kobo
- Example: ₦5,000 = 500,000 kobo

The conversion happens automatically in the `initializePayment` function:
```typescript
amount: Math.round(amount * 100) // Converts to kobo
```

## Webhook Security

The webhook endpoint verifies the Paystack signature using the secret key:

```typescript
const hash = crypto
  .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
  .update(body)
  .digest('hex');
```

This ensures only legitimate requests from Paystack are processed.

## Testing Webhooks

For testing in development (localhost), use [ngrok](https://ngrok.com):

1. Install ngrok: `npm install -g ngrok`
2. Run: `ngrok http 3000`
3. Copy the HTTPS URL ngrok provides
4. Add to Paystack webhooks: `https://[YOUR_NGROK_URL]/api/payments/webhook`
5. Now Paystack can reach your local dev server

## Payment References

- Payment references are generated in format: `[TIMESTAMP]-[RANDOM_STRING]`
- Examples: `1709123456789-ABC123XYZ`
- Used to track and verify payments in the database

## Troubleshooting

### "Failed to initialize payment" error
- Check `PAYSTACK_SECRET_KEY` is set correctly (should start with `sk_live_` or `sk_test_`)
- Verify the API key is for the correct environment (test vs. live)
- Check network request in browser DevTools

### Webhook not triggering
- Verify webhook URL is correct in Paystack dashboard
- Check webhook signing secret matches `PAYSTACK_SECRET_KEY`
- Review Paystack dashboard webhook logs for failed deliveries
- Ensure your app is publicly accessible (not localhost)

### Payment shows in Paystack but not in app
- Check webhook logs in Paystack dashboard
- Verify database connection and order table
- Check server logs for webhook processing errors
- Manually verify payment status: `/api/payments/verify/[REFERENCE]`

## References

- [Paystack Payments Docs](https://paystack.com/docs/payments/accept-payments/)
- [Paystack Verification Docs](https://paystack.com/docs/payments/verify-payments/)
- [Paystack Webhooks Docs](https://paystack.com/docs/payments/webhooks/)
- [Paystack API Reference](https://paystack.com/docs/api/)
