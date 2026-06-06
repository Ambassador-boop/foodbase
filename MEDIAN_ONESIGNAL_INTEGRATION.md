# OneSignal + Median JavaScript Bridge Integration

This document explains the integration between OneSignal push notifications and the Median JavaScript Bridge for the business owner dashboard.

## Overview

The integration allows the web-based business owner dashboard to send and receive push notifications through the Median WebView app. When wrapped in the Median app, users receive native push notifications about new orders and order status updates.

## Architecture

### Environment Detection
- The system automatically detects if it's running in the Median app environment
- All Median bridge calls are safe - they silently fail in regular browsers
- No breaking changes when running in a regular browser

### Key Components

#### 1. Median Bridge (`lib/median-bridge.ts`)
Safe wrapper functions around Median's OneSignal bridge:
- `isMedianEnvironment()` - Checks if running in Median app
- `initOneSignal(userEmail)` - Initializes OneSignal with user email as external ID
- `requestPushPermission()` - Requests permission for push notifications
- `getOneSignalInfo()` - Retrieves OneSignal user ID and external ID
- `logoutOneSignal()` - Unlinks device on logout
- `initializeOneSignalFlow(userEmail)` - Complete initialization + token save

#### 2. Notification Handler (`lib/median-notification-handler.ts`)
Sets up callback for when user taps a notification:
- `setupMedianNotificationHandler(router)` - Installs the handler
- `removeMedianNotificationHandler()` - Cleans up handler
- Routes to order detail page when notification is tapped

#### 3. Notification Setup Component (`components/dashboard/median-notification-setup.tsx`)
Client component that initializes the notification system:
- Automatically runs on dashboard load
- Can be used as a component or custom hook
- Handles errors gracefully

## API Endpoints

### 1. Save Push Token
**POST** `/api/save-push-token`
```json
{
  "oneSignalUserId": "string",
  "externalId": "user@example.com",
  "email": "user@example.com"
}
```
Saves the OneSignal device token to associate with the user.

### 2. Send Order Notification
**POST** `/api/notifications/send-order`
```json
{
  "orderId": "order-123",
  "businessId": "business-456"
}
```
Sends a rich notification with order details including:
- Customer name
- Order ID
- Menu items with prices
- Payment status
- Total amount

### 3. Order Status Update Notification
**POST** `/api/notifications/update-order-status`
```json
{
  "orderId": "order-123",
  "status": "preparing",
  "paymentStatus": "paid"
}
```
Sends a notification when order status changes. Creates a new notification (not an update).

### 4. Manual Notification Trigger
**POST** `/api/orders/notify?orderId=order-123&type=reminder`

Query parameters:
- `orderId` (required) - Order ID
- `type` (optional) - 'manual', 'reminder', or 'status'

Manually send or resend a notification for testing or recovery.

## Setup Instructions

### 1. Environment Variables
Add to `.env.local`:
```
NEXT_PUBLIC_ONESIGNAL_APP_ID=<your-onesignal-app-id>
ONESIGNAL_REST_API_KEY=<your-onesignal-rest-api-key>
```

### 2. Dashboard Setup
In your dashboard layout or page, add the notification setup component:

```tsx
'use client';

import { MedianNotificationSetup } from '@/components/dashboard/median-notification-setup';
import { useAuth } from '@/lib/auth'; // Your auth hook

export default function DashboardLayout({ children }) {
  const { user } = useAuth();

  return (
    <>
      {user?.email && <MedianNotificationSetup userEmail={user.email} />}
      {children}
    </>
  );
}
```

Or use the hook approach:
```tsx
const { initialized, error, inMedianApp } = useMedianNotifications(user?.email);
```

### 3. Request Push Permission
Add a button to request push notifications:

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { requestPushPermission } from '@/lib/median-bridge';

export function PushPermissionButton() {
  const handleRequestPermission = async () => {
    const granted = await requestPushPermission();
    if (granted) {
      console.log('Push notifications enabled');
    }
  };

  return (
    <Button onClick={handleRequestPermission}>
      Enable Push Notifications
    </Button>
  );
}
```

## Notification Flow

### On Login
1. User logs in via `/api/auth/login`
2. Frontend detects Median environment
3. Calls `initializeOneSignalFlow(userEmail)`
4. OneSignal initialized with user email as external ID
5. Device token saved to backend
6. Notification handler installed

### New Order
1. Order created and payment confirmed
2. Call `POST /api/notifications/send-order`
3. Backend fetches full order details (items, prices, totals)
4. Builds rich notification payload
5. Sends via OneSignal to business owner
6. Records notification in database

### Order Status Update
1. Order status changed (preparing, ready, etc.)
2. Call `POST /api/notifications/update-order-status`
3. Backend creates new notification (not update)
4. Sends via OneSignal with new status
5. Records in database for history

### Notification Tap
1. User taps notification in Median app
2. `window.medianOpenedPushNotification` callback triggered
3. Notification data parsed (order ID, type, target URL)
4. Route to `/dashboard/orders/[orderId]`
5. Display full order details

## Notification Payload Structure

### Order Item Notification Data
```json
{
  "orderId": "order-123",
  "type": "new_order",
  "targetUrl": "/dashboard/orders/order-123",
  "customerName": "John Doe",
  "paymentStatus": "paid",
  "totalAmount": "25.99",
  "itemCount": "3"
}
```

### Status Update Notification Data
```json
{
  "orderId": "order-123",
  "type": "order_status_update",
  "targetUrl": "/dashboard/orders/order-123",
  "status": "preparing",
  "paymentStatus": "paid",
  "customerName": "John Doe"
}
```

## Best Practices

### 1. Email as External ID
- Use customer email as OneSignal external ID
- Enables easy integration with other OneSignal features
- Allows users to receive notifications across devices

### 2. Rich Notification Content
- Include order details in notification body
- Show items, prices, and totals
- Help business owner understand order at a glance

### 3. Error Handling
- All Median bridge calls fail gracefully
- Non-Median environments work normally
- API errors are logged but don't crash the app

### 4. Permission Handling
- Request push permission after user action (button click)
- Not on app load to avoid annoying users
- Let OS handle permission UI

### 5. Testing
- Test in regular browser (bridge not available)
- Test in Median app with bridge available
- Check notification appears with correct data
- Verify routing works correctly

## Troubleshooting

### Notifications not appearing
1. Check `NEXT_PUBLIC_ONESIGNAL_APP_ID` is correct
2. Verify user has OneSignal segment tag set correctly
3. Check device has push enabled in OneSignal dashboard
4. Review OneSignal audit logs for errors

### Notification tap not routing correctly
1. Check `window.medianOpenedPushNotification` callback is set
2. Verify payload includes `orderId` or `targetUrl`
3. Check `/dashboard/orders/[orderId]` route exists
4. Review browser console for routing errors

### Push token not saving
1. Check `/api/save-push-token` endpoint returns 200
2. Verify user exists in database
3. Check database query for errors
4. Review API logs

### Not detecting Median environment
1. Check `window.median` exists in Median app
2. Verify `window.median.isNativeApp === true`
3. Test in actual Median app, not mobile browser
4. Check Median app version supports bridge

## OneSignal Configuration

### App Setup
1. Create app in OneSignal dashboard
2. Add OneSignal App ID to environment
3. Generate REST API key
4. Enable Android/iOS push channels

### Segmentation
- Orders tagged with `business_id` to target specific owner
- Create OneSignal segments for different business owners
- Use filters: `tag: business_id = <business-id>`

### Channels
- Android: Set channel ID to "order_notifications" and "order_status_updates"
- iOS: Uses default notification channel
- Priority: Set to 10 for order notifications

## Database Schema

### notifications table
```sql
CREATE TABLE notifications (
  id character varying PRIMARY KEY,
  order_id character varying,
  business_id character varying,
  notification_title character varying,
  notification_body text,
  onesignal_notification_id character varying,
  customer_name character varying,
  payment_status character varying,
  is_read boolean DEFAULT false,
  created_at timestamp without time zone,
  updated_at timestamp without time zone
);
```

The table stores notification history for audit and resend purposes.

## Security Considerations

1. **Email as External ID**: Safe to use - emails are user identifiers
2. **Order Data in Payload**: Only includes public order info (ID, customer name, amount)
3. **Authorization**: API endpoints should validate business owner in production
4. **Sensitive Data**: Never include payment details or customer contact in payload
5. **Device Association**: OneSignal handles secure device token management

## Future Enhancements

1. **Device Token Storage**: Create dedicated `device_tokens` table
2. **Notification Preferences**: Allow users to customize notification types
3. **Retry Logic**: Implement exponential backoff for failed notifications
4. **Scheduled Notifications**: Schedule notifications for specific times
5. **Notification Analytics**: Track open rates and interactions
6. **Multiple Users**: Support multiple business users on one account
7. **Notification Center**: In-app notification history and management

## Related Files

- `lib/median-bridge.ts` - Median bridge utilities
- `lib/median-notification-handler.ts` - Notification handler
- `components/dashboard/median-notification-setup.tsx` - Setup component
- `app/api/save-push-token/route.ts` - Token save endpoint
- `app/api/notifications/send-order/route.ts` - Order notification
- `app/api/notifications/update-order-status/route.ts` - Status notification
- `app/api/orders/notify/route.ts` - Manual notification
