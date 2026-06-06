# OneSignal + Median Integration - Get Started in 5 Minutes

## Step 1: Add Environment Variables (1 minute)

### In your v0 project settings (top right → Settings → Vars):
```
NEXT_PUBLIC_ONESIGNAL_APP_ID=<copy-from-onesignal>
ONESIGNAL_REST_API_KEY=<copy-from-onesignal>
```

**Where to find these:**
1. Go to https://dashboard.onesignal.com
2. Select your app
3. Go to Settings → API Keys
4. Copy both values

---

## Step 2: Add Notification Setup Component (2 minutes)

### In your dashboard layout (e.g., `app/dashboard/layout.tsx`):

```tsx
'use client';

import { MedianNotificationSetup } from '@/components/dashboard/median-notification-setup';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get your user from wherever you store session/auth
  // const { user } = useSession() or your auth method
  const user = { email: 'user@example.com' }; // Replace with actual user

  return (
    <>
      {user?.email && <MedianNotificationSetup userEmail={user.email} />}
      {children}
    </>
  );
}
```

---

## Step 3: Send Notifications (2 minutes)

### When a new order is created:
```typescript
// After order payment is confirmed
await fetch('/api/notifications/send-order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    orderId: order.id,        // Order ID from database
    businessId: order.business_id  // Business owner ID
  })
});
```

### When order status changes:
```typescript
// When status is updated (preparing, ready, delivered, etc.)
await fetch('/api/notifications/update-order-status', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    orderId: order.id,
    status: 'preparing',  // or 'ready', 'out_for_delivery', etc.
    paymentStatus: 'paid'  // current payment status
  })
});
```

---

## Step 4: Test It (Optional but recommended)

### Test in terminal:
```bash
# Send a test notification
curl -X POST http://localhost:3000/api/notifications/send-order \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "test-123",
    "businessId": "test-biz-456"
  }'
```

Check OneSignal dashboard → Messages → you should see it delivered!

---

## That's It! 🎉

Your notifications are now integrated. Here's what happens:

### In Browser:
- ✅ App works normally (no errors)
- ✅ Notification setup runs but does nothing
- ✅ Logs show it's not in Median environment

### In Median App:
- ✅ OneSignal initializes on login
- ✅ Device token is saved
- ✅ Business owner receives notifications
- ✅ Tapping notification goes to order details

---

## Notification Features

### Order Notifications Include:
- 👤 Customer name
- 🆔 Order ID
- 🍽️ Menu items with quantities
- 💰 Prices for each item
- 💵 Order total
- ✅ Payment status
- 📦 Delivery address (if applicable)

### Example Notification:
```
Title: New Order from John Doe
Body: Order #abc123 - Burger x1, Fries x2 ($25.99) - Paid
```

### Status Update Notifications:
```
Title: Order Status Update
Body: Order #abc123 - Being Prepared - Paid
```

---

## Quick Reference

### Files Changed:
- ✅ `app/api/notifications/send-order/route.ts` - Enhanced
- ✅ `app/api/notifications/update-order-status/route.ts` - Enhanced
- ✅ `app/api/auth/login/route.ts` - Enhanced (logging only)

### Files Created:
- ✅ `lib/median-bridge.ts` - Median integration
- ✅ `lib/median-notification-handler.ts` - Notification handler
- ✅ `components/dashboard/median-notification-setup.tsx` - Setup component
- ✅ `app/api/save-push-token/route.ts` - Save device token
- ✅ `app/api/orders/notify/route.ts` - Manual notifications

### Documentation:
- 📖 `MEDIAN_ONESIGNAL_INTEGRATION.md` - Full documentation
- ✅ `ONESIGNAL_SETUP_CHECKLIST.md` - Complete checklist
- 📚 `ONESIGNAL_QUICK_REFERENCE.md` - API reference
- 📊 `FLOW_DIAGRAMS.md` - Visual diagrams
- ℹ️ `IMPLEMENTATION_SUMMARY.md` - What was built

---

## Need More Details?

- 📖 **Full Setup Guide**: Read `ONESIGNAL_SETUP_CHECKLIST.md`
- 🔍 **How It Works**: Check `FLOW_DIAGRAMS.md`
- 🎯 **API Reference**: See `ONESIGNAL_QUICK_REFERENCE.md`
- 📚 **Complete Docs**: View `MEDIAN_ONESIGNAL_INTEGRATION.md`
- ✨ **What's New**: Check `IMPLEMENTATION_SUMMARY.md`

---

## Testing Checklist

Before going to production:

- [ ] Environment variables added
- [ ] Dashboard component added
- [ ] Test in browser (should work normally)
- [ ] Test in Median app (should get notifications)
- [ ] Create test order
- [ ] Receive notification on Median app
- [ ] Tap notification (should go to order details)
- [ ] Order details display correctly

---

## Troubleshooting

**"Notifications not appearing?"**
1. Check environment variables are set correctly
2. Check OneSignal dashboard shows delivery
3. Check Median app has push permission enabled
4. Check browser console for `[v0]` logs

**"Not detecting Median environment?"**
1. Test in actual Median app (not mobile browser)
2. Check Median app version has JavaScript Bridge
3. Check `window.median?.isNativeApp` in console

**"Notification tap doesn't route?"**
1. Check notification includes `orderId` in data
2. Check `/dashboard/orders/[orderId]` route exists
3. Check browser console for routing errors

---

## API Endpoints Summary

### New Order
```
POST /api/notifications/send-order
Body: { orderId, businessId }
Returns: { success, notificationId }
```

### Order Status Update
```
POST /api/notifications/update-order-status
Body: { orderId, status, paymentStatus }
Returns: { success, notificationId }
```

### Save Device Token
```
POST /api/save-push-token
Body: { oneSignalUserId, externalId, email }
Returns: { success, userId, businessId }
```

### Manual Notification
```
POST /api/orders/notify?orderId=...&type=reminder
Returns: { success, message, notificationId }
```

---

## Next Steps After Setup

1. **Integrate order creation** - Call send-order endpoint
2. **Integrate order updates** - Call update-order-status endpoint
3. **Test with real orders** - Create orders and receive notifications
4. **Deploy to production** - Add env vars and redeploy
5. **Monitor notifications** - Check OneSignal dashboard regularly

---

## Questions?

- OneSignal Support: https://onesignal.com/support
- Median Support: https://median.com/support
- Your Development Team: [contact info]

---

**That's it! You now have push notifications integrated with Median and OneSignal.** 🚀

For a test drive, create an order and you should receive a notification on any Median app that's logged in!
