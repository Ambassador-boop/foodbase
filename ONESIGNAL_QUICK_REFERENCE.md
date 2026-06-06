# OneSignal + Median Bridge - Quick Reference

## 🚀 Quick Start

### 1. Environment Variables
```env
NEXT_PUBLIC_ONESIGNAL_APP_ID=<app-id>
ONESIGNAL_REST_API_KEY=<rest-key>
```

### 2. Dashboard Setup
```tsx
// In dashboard/layout.tsx
import { MedianNotificationSetup } from '@/components/dashboard/median-notification-setup';

<MedianNotificationSetup userEmail={user.email} />
```

### 3. Test Notification
```bash
curl -X POST http://localhost:3000/api/notifications/send-order \
  -H "Content-Type: application/json" \
  -d '{"orderId":"order-1","businessId":"business-1"}'
```

---

## 📚 Core APIs

### Median Bridge (`lib/median-bridge.ts`)
```typescript
// Check if in Median app
isMedianEnvironment(): boolean

// Initialize OneSignal
initOneSignal(userEmail: string): Promise<boolean>

// Request push permission
requestPushPermission(): Promise<boolean>

// Get OneSignal info
getOneSignalInfo(): Promise<OneSignalInfo | null>

// Logout from OneSignal
logoutOneSignal(): Promise<boolean>

// Complete flow
initializeOneSignalFlow(userEmail: string): Promise<string | null>
```

### Notification Handler (`lib/median-notification-handler.ts`)
```typescript
// Install notification handler
setupMedianNotificationHandler(router: NextRouter): void

// Remove handler
removeMedianNotificationHandler(): void
```

### Setup Component
```typescript
// Component approach
<MedianNotificationSetup userEmail={email} onInitComplete={callback} />

// Hook approach
const { initialized, error, inMedianApp } = useMedianNotifications(email)
```

---

## 📤 Notification Endpoints

### Send New Order Notification
```bash
POST /api/notifications/send-order
{
  "orderId": "order-123",
  "businessId": "business-456"
}
```
**Returns:**
- Order details with menu items and prices
- Rich notification payload

### Update Order Status
```bash
POST /api/notifications/update-order-status
{
  "orderId": "order-123",
  "status": "preparing",
  "paymentStatus": "paid"
}
```
**Returns:**
- New status notification sent
- Notification recorded in database

### Send Manual Notification
```bash
POST /api/orders/notify?orderId=order-123&type=reminder
```
**Query params:**
- `orderId` (required)
- `type` - 'manual' | 'reminder' | 'status'

### Save Push Token
```bash
POST /api/save-push-token
{
  "oneSignalUserId": "onesignal-user-id",
  "externalId": "user@example.com",
  "email": "user@example.com"
}
```

---

## 🔔 Notification Flow

```
New Order Created
    ↓
POST /api/notifications/send-order
    ↓
Fetch full order details (items, prices)
    ↓
Send rich notification via OneSignal
    ↓
Business owner receives notification in Median app
    ↓
User taps notification
    ↓
window.medianOpenedPushNotification callback
    ↓
Route to /dashboard/orders/[orderId]
    ↓
Display order details
```

---

## 💾 Database Tables

### notifications table
```sql
id                          -- Notification ID
order_id                    -- Related order
business_id                 -- Business owner
notification_title          -- Title shown
notification_body           -- Body text
onesignal_notification_id   -- OneSignal ID
customer_name              -- Order customer
payment_status             -- Payment status
is_read                    -- Read flag
created_at                 -- Timestamp
updated_at                 -- Timestamp
```

---

## 🧪 Testing Checklist

- [ ] Environment variables set
- [ ] Dashboard renders without errors
- [ ] Login flow works
- [ ] Console shows `[v0]` logs (in Median app)
- [ ] Create test order
- [ ] Notification appears in OneSignal dashboard
- [ ] Notification appears in Median app (if permission granted)
- [ ] Tapping notification routes correctly
- [ ] Order details page loads

---

## ⚠️ Common Issues

| Problem | Solution |
|---------|----------|
| Notifications not sending | Check `NEXT_PUBLIC_ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY` |
| Not routing on tap | Verify `window.medianOpenedPushNotification` callback is installed |
| Crashing in browser | Already safe - all Median calls fail gracefully |
| Push permission not showing | Call `requestPushPermission()` after user action, not on load |
| Notification shows wrong order | Check notification payload `orderId` is correct |

---

## 🔒 Security Notes

- ✅ Email used as external ID (safe)
- ✅ OneSignal handles device tokens (secure)
- ✅ Order data in payload is non-sensitive
- ✅ All Median calls fail gracefully
- ⚠️ Never include payment details in notifications
- ⚠️ Validate business owner in production APIs

---

## 📂 Key Files Created

| File | Purpose |
|------|---------|
| `lib/median-bridge.ts` | Median JavaScript Bridge utilities |
| `lib/median-notification-handler.ts` | Notification tap handler |
| `components/dashboard/median-notification-setup.tsx` | Setup component & hooks |
| `app/api/save-push-token/route.ts` | Save device token |
| `app/api/notifications/send-order/route.ts` | Send order notifications |
| `app/api/notifications/update-order-status/route.ts` | Send status notifications |
| `app/api/orders/notify/route.ts` | Manual notification trigger |
| `MEDIAN_ONESIGNAL_INTEGRATION.md` | Full documentation |
| `ONESIGNAL_SETUP_CHECKLIST.md` | Setup checklist |

---

## 🌐 Environment Detection

```typescript
// Automatically handled by middleware
if (window.median?.isNativeApp) {
  // Running in Median app - enable bridge features
} else {
  // Regular browser - features gracefully disabled
}
```

---

## 📊 OneSignal Configuration

### Segmentation
- Filter: `tag:business_id equals <business-id>`
- Targets: Specific business owner's devices

### Priority
- Order notifications: Priority 10 (high)
- Status updates: Priority 10 (high)
- Reminders: Priority 5 (normal)

### Channels
- Android: `order_notifications`, `order_status_updates`
- iOS: Default notification channel

---

## 🚦 Status Update Messages

```
pending → "Pending Preparation"
preparing → "Being Prepared"
ready → "Ready for Pickup"
out_for_delivery → "Out for Delivery"
completed → "Completed"
cancelled → "Cancelled"
```

---

## 💡 Usage Examples

### Initialize in Component
```tsx
useEffect(() => {
  if (user?.email) {
    initializeOneSignalFlow(user.email).then((userId) => {
      if (userId) {
        console.log('OneSignal ready:', userId);
      }
    });
  }
}, [user?.email]);
```

### Request Permission on Button Click
```tsx
<Button onClick={async () => {
  const granted = await requestPushPermission();
  if (granted) {
    toast.success('Push notifications enabled');
  }
}}>
  Enable Notifications
</Button>
```

### Send Order Notification
```typescript
// After order creation and payment confirmation
await fetch('/api/notifications/send-order', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    orderId: order.id,
    businessId: order.business_id
  })
});
```

### Update Order Status
```typescript
// When order status changes
await fetch('/api/notifications/update-order-status', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    orderId: order.id,
    status: 'preparing',
    paymentStatus: order.payment_status
  })
});
```

---

## 🔗 Related Resources

- OneSignal: https://onesignal.com
- Median: https://median.com
- Full Docs: `MEDIAN_ONESIGNAL_INTEGRATION.md`
- Setup Guide: `ONESIGNAL_SETUP_CHECKLIST.md`

---

**Version:** 1.0.0 | **Updated:** June 6, 2026
