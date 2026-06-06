# OneSignal + Median Bridge Notifications Workflow

## Overview

This document explains the complete notification workflow for your business owner dashboard integrated with Median app and OneSignal push notifications.

## What The Dashboard Component Does

The `MedianNotificationSetup` component is a **silent initialization component** that runs in the dashboard. It handles all OneSignal bridge setup without displaying anything on screen.

### Key Responsibilities:

1. **Environment Detection** - Detects if running in Median app or regular browser
2. **OneSignal Login** - Associates user device with their email via OneSignal
3. **Device Token Storage** - Saves the OneSignal device ID to your backend database
4. **Notification Tap Handler** - Sets up listener for when users tap notifications
5. **Permission Management** - Handles push notification permission requests

## Complete Workflow

### 1. Order Creation → Immediate Notification

**When a customer creates an order:**

```
Customer Places Order
        ↓
    POST /api/orders
        ↓
Order Created in Database
        ↓
AUTOMATIC NOTIFICATION SENT (regardless of payment)
        ↓
POST /api/notifications/send-order (automatically called)
        ↓
Rich Notification Created:
├─ Customer Name
├─ Order ID
├─ Menu Items with Prices
├─ Total Amount
├─ Payment Status: "pending"
└─ Delivery Info
        ↓
OneSignal Sends to Business Owner Device
        ↓
Notification appears on Business Owner's Phone
```

**Code Location:** `/app/api/orders/route.ts` (lines 172-202)

### 2. Payment Completed → Status Update Notification

**When customer completes payment:**

```
Customer Completes Payment
        ↓
    Paystack Processes Payment
        ↓
POST /api/payments/verify (or webhook)
        ↓
Payment Marked as "paid" & Order Status = "confirmed"
        ↓
AUTOMATIC STATUS UPDATE NOTIFICATION
        ↓
POST /api/notifications/update-order-status (automatically called)
        ↓
New Notification Created:
├─ Title: "Order Status Update"
├─ Body: "Order #ABC123 - Payment Completed"
├─ Status: "confirmed"
└─ Payment Status: "paid"
        ↓
OneSignal Sends to Business Owner Device
        ↓
Business Owner Sees Payment Status Updated
```

**Code Locations:**
- Verify endpoint: `/app/api/payments/verify/route.ts` (lines 206-218)
- Webhook endpoint: `/app/api/payments/webhook/route.ts` (lines 74-94)

### 3. Notification Tap → Navigation

**When business owner taps a notification:**

```
Business Owner Taps Notification
        ↓
Median Captures Tap Event
        ↓
window.medianOpenedPushNotification Called
        ↓
Extract targetUrl from Notification Data
        ↓
router.push("/dashboard/orders/{orderId}")
        ↓
Order Details Page Displayed
```

**Code Location:** `/lib/median-notification-handler.ts`

## Implementation Details

### Step 1: Dashboard Initialization

The component is already added to `/app/dashboard/layout.tsx`:

```tsx
{userEmail && <MedianNotificationSetup userEmail={userEmail} />}
```

This:
- Fetches user email from `/api/user/profile`
- Passes email to the notification setup component
- Component initializes OneSignal with the email as external ID
- No visible UI is rendered

### Step 2: Automatic Order Notification

When order is created via `POST /api/orders`:

```typescript
// Automatically triggers notification
const notificationResponse = await fetch(
  '/api/notifications/send-order',
  {
    method: 'POST',
    body: JSON.stringify({
      orderId,
      businessId,
      customerName,
    }),
  }
);
```

**Features:**
- Sends immediately, before payment
- Includes full order details (items, prices, totals)
- Shows payment status: "pending"
- Database records the notification

### Step 3: Payment Completion Notification

When payment is verified via `POST /api/payments/verify` or webhook:

```typescript
// Automatically triggers status update
const notificationResponse = await fetch(
  '/api/notifications/update-order-status',
  {
    method: 'POST',
    body: JSON.stringify({
      orderId: order.id,
      status: 'confirmed',
      paymentStatus: 'paid',
    }),
  }
);
```

**Features:**
- Sends new notification (not updating existing one)
- Updates payment status to "paid"
- Shows order is "confirmed"
- Creates audit trail in database

## Environment Variables

These should already be set in your project:

```env
# Required for OneSignal
NEXT_PUBLIC_ONESIGNAL_APP_ID=your_app_id_here
ONESIGNAL_REST_API_KEY=your_rest_api_key_here

# Optional (for internal API calls)
NEXT_PUBLIC_API_URL=http://localhost:3000  # or your deployed URL
```

## Database Schema

The implementation uses these existing tables:

**orders**
- `id` - Order ID
- `business_id` - Restaurant/business ID
- `customer_name` - Customer name
- `total_amount` - Order total
- `payment_status` - 'pending', 'paid', 'completed'
- `status` - 'pending', 'confirmed', etc.

**order_items**
- `order_id` - Links to orders
- `menu_item_id` - Links to menu items
- `quantity` - How many
- `item_price` - Price per item

**menu_items**
- `id` - Menu item ID
- `name` - Item name

**notifications** (for audit trail)
- `id` - Notification ID
- `order_id` - Related order
- `business_id` - Related business
- `notification_title` - What was sent
- `notification_body` - Message body
- `onesignal_notification_id` - OneSignal's ID
- `payment_status` - Payment status at time of notification
- `customer_name` - Customer name
- `is_read` - Whether business owner saw it

## API Endpoints

### POST /api/notifications/send-order

Sends immediate notification when order is created.

**Request:**
```json
{
  "orderId": "abc123",
  "businessId": "biz456",
  "customerName": "John Doe"
}
```

**Response:**
```json
{
  "success": true,
  "notificationId": "onesignal_id_here",
  "orderId": "abc123",
  "message": "Order notification sent successfully"
}
```

**What It Does:**
- Fetches full order details from database
- Gets all order items with prices
- Builds rich notification payload
- Sends via OneSignal REST API
- Records in notifications table

### POST /api/notifications/update-order-status

Sends status update when order status or payment changes.

**Request:**
```json
{
  "orderId": "abc123",
  "status": "confirmed",
  "paymentStatus": "paid"
}
```

**Response:**
```json
{
  "success": true,
  "notificationId": "onesignal_id_here",
  "orderId": "abc123",
  "message": "Status update notification sent successfully"
}
```

**What It Does:**
- Fetches order details
- Creates human-readable status display
- Sends new notification (not update of previous)
- Records in notifications table

### POST /api/save-push-token

Saves device token to backend.

**Called By:** MedianNotificationSetup component automatically

**Request:**
```json
{
  "oneSignalUserId": "uuid_from_onesignal",
  "externalId": "user@example.com",
  "userEmail": "user@example.com"
}
```

### POST /api/orders/notify

Manual endpoint to trigger notification for an existing order.

**Request:**
```json
{
  "orderId": "abc123",
  "notificationType": "order_created"
}
```

## Testing

### Test Order Creation Notification

1. In browser or app, place an order
2. Check business owner's phone for notification
3. Notification should appear immediately
4. Shows payment status as "pending"

### Test Payment Completion Notification

1. Complete payment in checkout
2. Check business owner's phone
3. New notification should appear
4. Shows payment status as "paid"
5. Shows order status as "confirmed"

### Test Notification Tap

1. Business owner taps notification on phone
2. Should navigate to order detail page: `/dashboard/orders/{orderId}`
3. Page shows full order information

### Test in Regular Browser

If you're not in Median app:
- Component detects this
- OneSignal initialization is skipped
- Dashboard works normally
- No notifications sent (graceful fallback)

## Debugging

### Check Logs

All operations log with `[v0]` prefix:

```
[v0] Order API: Creating order with fields: {...}
[v0] Order API: Triggering immediate notification for order: abc123
[v0] Notification recorded in database: notif_xyz
[v0] Dashboard: User email loaded for notifications
[v0] MedianNotificationSetup: Bridge initialized successfully
```

### Common Issues

**No notifications appearing:**
- Check environment variables are set
- Verify in Median app (not browser)
- Check OneSignal app is created with correct ID
- Check business owner's OneSignal tag is correct: `business_id=abc123`

**Payment notification not sent:**
- Check payment verification endpoint is being called
- Verify order payment_status is updated to "paid"
- Check notification endpoint response for errors

**Notification doesn't navigate:**
- Check data.targetUrl is being sent in payload
- Verify Next.js router can access `/dashboard/orders/{orderId}`
- Check orderId is formatted correctly

## Files Modified/Created

### Created:
- `/lib/median-bridge.ts` - OneSignal bridge utilities
- `/lib/median-notification-handler.ts` - Notification tap handler
- `/components/dashboard/median-notification-setup.tsx` - Component
- `/app/api/save-push-token/route.ts` - Token storage endpoint
- `/app/api/orders/notify/route.ts` - Manual notification endpoint

### Modified:
- `/app/dashboard/layout.tsx` - Added component and user email fetch
- `/app/api/orders/route.ts` - Added automatic notification on creation
- `/app/api/payments/verify/route.ts` - Added status update notification
- `/app/api/payments/webhook/route.ts` - Added status update notification

## Summary

**The flow is now:**

1. ✅ **Order Created** → Immediate notification sent with order details and "pending" payment status
2. ✅ **Payment Completed** → New status update notification sent showing "paid" status
3. ✅ **Notification Tapped** → Opens order detail page in app
4. ✅ **All automatic** → No manual API calls needed, everything triggers automatically
5. ✅ **Works in browser and app** → Graceful fallback if not in Median

Everything is working automatically. No additional setup needed!
