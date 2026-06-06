# Push Notifications FAQ

## How Push Notifications Work

### Basic Flow
1. **Server sends notification** - Your backend calls OneSignal API with notification data
2. **OneSignal receives it** - OneSignal stores the notification on their servers
3. **Device receives it** - OneSignal sends to business owner's device via OS push service
4. **OS displays it** - Android/iOS shows notification in notification center
5. **App opens** (if user taps) - OneSignal SDK delivers it to your app
6. **App navigates** - Your app's notification handler routes to the order page

## Will Notifications Be Received If App Is Closed?

**YES, absolutely!** This is the entire point of push notifications.

### How It Works:
- **When app is open** - Notification appears immediately and app can handle it
- **When app is closed** - Device OS receives it and shows in notification center
- **When user opens app later** - OS delivers notification to your app
- **App routes** - Notification handler processes it and opens the order details

### Example Timeline:
```
1:00 PM - Order created → Notification #1 sent
         (App might be closed, notification sits in notification center)
1:15 PM - Business owner opens app
         (OS delivers notification, user sees "New Order from John")
1:16 PM - User taps notification
         (App navigates to order details page)
```

## How Many Notifications Does a Customer Get?

**One notification per event**:

1. **Order Creation** (immediate):
   - "New Order from John Doe"
   - Shows: Order ID, items, total, payment status: pending

2. **Payment Completed** (when payment verified):
   - "Order Status Update"
   - Shows: Order ID, status: confirmed, payment: paid

So for a complete order journey: **2 notifications minimum**

## Can Notifications Be Sent When App is Closed?

**YES!** The app doesn't need to be running at all.

OneSignal uses:
- **Android** - Google Cloud Messaging (FCM)
- **iOS** - Apple Push Notification service (APNs)
- **Web** - Web Push API

These are **OS-level** services, not your app. They deliver notifications to the device hardware, which then displays them.

## What Information Is in Each Notification?

### New Order Notification
```
Title: "New Order from [Customer Name]"
Body: "Order #ABC123 - Item x2 ($50) - pending"
Data:
  - orderId: ABC123
  - type: new_order
  - customerName: John Doe
  - paymentStatus: pending
  - totalAmount: $50
  - itemCount: 2
  - targetUrl: /dashboard/orders/ABC123
```

### Payment Status Notification
```
Title: "Order Status Update"
Body: "Order #ABC123 - Confirmed - paid"
Data:
  - orderId: ABC123
  - type: order_status_update
  - status: confirmed
  - paymentStatus: paid
  - customerName: John Doe
  - targetUrl: /dashboard/orders/ABC123
```

## What Happens When User Taps Notification?

1. **Notification tap detected** - `window.medianOpenedPushNotification()` callback fired
2. **Extract target URL** - `data.targetUrl = "/dashboard/orders/ABC123"`
3. **Navigate to page** - `router.push(targetUrl)`
4. **Show order details** - User sees full order information

## Why Did Order Creation Notification Fail Before?

**Error was**: `TypeError: Failed to parse URL from /api/notifications/send-order`

**Reason**: On the server, relative URLs don't work with `fetch()`. The code was trying:
```typescript
fetch('/api/notifications/send-order', { ... })  // ❌ Fails on server
```

**Solution**: Import and call the function directly:
```typescript
import { sendNewOrderNotification } from '@/lib/notification-service';
await sendNewOrderNotification(orderId, businessId);  // ✅ Works!
```

## Will Notifications Work on Multiple Devices?

**Partially** - Current setup targets by `business_id` tag:

```typescript
filters: [{ field: 'tag', key: 'business_id', value: businessId }]
```

This means:
- All devices logged in as that business owner will receive the notification
- If same owner has app on phone AND tablet, both get the notification
- ✅ This is the correct behavior!

## How Are Business Owners Identified?

**Using OneSignal User IDs**:

1. **On Login** - `MedianNotificationSetup` component calls:
   ```typescript
   median.onesignal.login(userEmail)
   ```

2. **External ID Set** - OneSignal knows this device belongs to that email

3. **Business Tagging** - When saving push token:
   ```typescript
   await fetch('/api/save-push-token', {
     oneSignalUserId, 
     externalId: userEmail,
     userEmail
   })
   ```

4. **Notifications Targeted** - By business_id tag

## What if OneSignal is Down?

The code handles this gracefully:

```typescript
try {
  const notificationSent = await sendNewOrderNotification(...);
  if (!notificationSent) {
    console.warn('Notification failed, but continuing with order');
  }
} catch (error) {
  console.error('Notification error:', error);
  // Order creation continues - doesn't block!
}
```

**Result**: Order still gets created, user just doesn't get notification (rare case).

## Testing Notifications Locally

1. **Install Median app** on test device
2. **Log in as business owner**
3. **Create order** through checkout
4. **Check phone notification** - should appear immediately
5. **Complete payment** - second notification should appear
6. **Tap notification** - should navigate to order details

## Debugging Notifications

**Check console logs** with `[v0]` prefix:

```
[v0] Sending OneSignal notification...
[v0] Notification recorded in database: notif_123
[v0] New order notification sent successfully: sig_456
```

**If notification didn't send**:
1. Check environment variables are set
2. Check OneSignal app ID is correct
3. Check business owner is logged in
4. Check internet connection on device
5. Check OneSignal dashboard for errors

## How Many Characters Can Be in Notification?

- **Title**: ~50 characters (varies by OS)
- **Body**: ~150 characters (varies by OS)
- **Data fields**: Unlimited (stored for navigation)

Current notifications fit comfortably within limits.

## Are Notifications Secure?

**Yes**:
1. **OneSignal handles encryption** - Uses HTTPS/TLS
2. **Data is minimal** - Just order ID and status
3. **No sensitive data** - No passwords, credit cards, etc.
4. **Business owner only** - Notifications only to logged-in owner
5. **User email as ID** - Email is safe identifier

## What if Business Owner Uninstalls App?

Notifications will fail silently:
1. OneSignal tries to send
2. Device can't receive (app not installed)
3. OneSignal marks as undeliverable
4. No error on your end (graceful handling)

If they reinstall:
1. New installation gets new OneSignal ID
2. Next login, `MedianNotificationSetup` re-initializes
3. Notifications work again

## Summary

✅ Notifications work even when app is closed
✅ Multiple notifications per order lifecycle  
✅ Rich information in each notification
✅ Automatic routing to order details on tap
✅ Graceful error handling
✅ Immediate delivery
✅ Works on multiple devices for same owner
✅ Secure and private

Everything is set up correctly and ready to use!
