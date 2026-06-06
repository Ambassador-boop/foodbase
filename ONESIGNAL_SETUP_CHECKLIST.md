# OneSignal + Median Integration Setup Checklist

## Prerequisites
- [ ] Median app configured with WebView
- [ ] OneSignal account created
- [ ] OneSignal App ID obtained
- [ ] OneSignal REST API key generated

## Environment Setup

### 1. Add Environment Variables
In your v0 project settings (Vars section):
```
NEXT_PUBLIC_ONESIGNAL_APP_ID=<your-app-id>
ONESIGNAL_REST_API_KEY=<your-rest-api-key>
```

**Where to find these:**
1. Go to [OneSignal Dashboard](https://dashboard.onesignal.com)
2. Select your app
3. Go to Settings → API Keys
4. Copy "App ID" and "REST API Key"

## Code Integration

### 2. Add Notification Setup to Dashboard
Update your dashboard layout (`app/dashboard/layout.tsx` or similar):

```tsx
'use client';

import { MedianNotificationSetup } from '@/components/dashboard/median-notification-setup';
import { useSession } from '@/lib/auth'; // Your auth hook

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useSession();

  return (
    <>
      {user?.email && <MedianNotificationSetup userEmail={user.email} />}
      {children}
    </>
  );
}
```

### 3. Add Permission Request Button (Optional)
In a settings or onboarding page:

```tsx
'use client';

import { Button } from '@/components/ui/button';
import { requestPushPermission } from '@/lib/median-bridge';

export function PushNotificationSettings() {
  const handleEnable = async () => {
    const granted = await requestPushPermission();
    if (granted) {
      console.log('✓ Push notifications enabled');
    } else {
      console.log('✗ Push notifications denied');
    }
  };

  return (
    <Button onClick={handleEnable}>
      Enable Push Notifications
    </Button>
  );
}
```

## Testing

### 4. Test in Development
1. [ ] Run dev server: `npm run dev` or `pnpm dev`
2. [ ] Login to dashboard
3. [ ] Check browser console for `[v0]` logs
4. [ ] Verify no errors in console (should gracefully skip in browser)

### 5. Test Order Notification
Create a test order or call the API:
```bash
curl -X POST http://localhost:3000/api/notifications/send-order \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "test-order-123",
    "businessId": "test-business-456"
  }'
```

### 6. Test Status Update Notification
```bash
curl -X POST http://localhost:3000/api/notifications/update-order-status \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "test-order-123",
    "status": "preparing",
    "paymentStatus": "paid"
  }'
```

### 7. Test Manual Notification
```bash
curl -X POST "http://localhost:3000/api/orders/notify?orderId=test-order-123&type=reminder"
```

## OneSignal Configuration

### 8. Configure OneSignal App
1. [ ] Go to OneSignal Dashboard
2. [ ] Select your app
3. [ ] Go to Settings → Email
4. [ ] Ensure app is configured for your platform (Android/iOS)

### 9. Create Business ID Segment
1. [ ] Go to Audience → Segments
2. [ ] Create new segment
3. [ ] Name it "Test Business Owner"
4. [ ] Add filter: `tag:business_id equals test-business-456`
5. [ ] Save segment

### 10. Test Notification in OneSignal
1. [ ] Go to Messages → New Message
2. [ ] Create simple notification: "Test Notification"
3. [ ] Send to your test segment
4. [ ] Verify notification appears in OneSignal dashboard logs

## Median App Setup

### 11. Test in Median WebView
1. [ ] Build Median app with latest JavaScript Bridge
2. [ ] Open dashboard in Median app
3. [ ] Login with test account
4. [ ] Check browser console (via Median DevTools or similar)
5. [ ] Should see `[v0] Initializing OneSignal for user: ...` logs

### 12. Test Push Notifications in Median
1. [ ] Ensure push permissions are granted
2. [ ] Create a test order via admin panel or API
3. [ ] Should receive notification in Median app
4. [ ] Tap notification, should navigate to order detail
5. [ ] Verify order details display correctly

### 13. Test Notification Tap Routing
1. [ ] Verify notification payload includes `orderId` or `targetUrl`
2. [ ] Tap notification from Median app
3. [ ] Should navigate to `/dashboard/orders/[orderId]`
4. [ ] Order details should load and display

## Production Deployment

### 14. Update Environment Variables
In Vercel project settings:
1. [ ] Add `NEXT_PUBLIC_ONESIGNAL_APP_ID`
2. [ ] Add `ONESIGNAL_REST_API_KEY`
3. [ ] Redeploy after adding variables

### 15. Test in Production
1. [ ] Deploy to production
2. [ ] Test login flow in Median app
3. [ ] Send test order notification
4. [ ] Verify notification appears on production OneSignal dashboard
5. [ ] Test notification tap routing

## Monitoring & Maintenance

### 16. Set Up Monitoring
- [ ] Monitor API errors in logs: `/api/notifications/send-order`, `/api/notifications/update-order-status`
- [ ] Check OneSignal dashboard for delivery failures
- [ ] Monitor notification database table for audit trail
- [ ] Set up alerts for failed notifications

### 17. Document System
- [ ] Share `MEDIAN_ONESIGNAL_INTEGRATION.md` with team
- [ ] Document any customizations made
- [ ] Create runbook for troubleshooting
- [ ] Document OneSignal account access and credentials

## Customization Options

### Optional: Add Company Logo to Notifications
In notification payload, add:
```typescript
big_picture: 'https://your-domain.com/logo.png',
large_icon: 'https://your-domain.com/icon.png',
```

### Optional: Custom Notification Sounds
In notification payload:
```typescript
android_channel_id: 'order_notifications', // With custom sound
```

### Optional: Notification Categories
Add notification categories for different order types:
```typescript
// For urgent orders
priority: 10,
android_channel_id: 'order_notifications',

// For reminders
priority: 5,
android_channel_id: 'order_reminders',
```

### Optional: Rich Notification Images
Generate order preview images and include:
```typescript
big_picture: generateOrderImage(order),
```

## Troubleshooting Guide

If notifications aren't appearing:

1. **Check environment variables**
   ```bash
   # In Vercel settings, verify both are set:
   - NEXT_PUBLIC_ONESIGNAL_APP_ID
   - ONESIGNAL_REST_API_KEY
   ```

2. **Check browser console**
   - Open DevTools in browser or Median DevTools
   - Look for `[v0]` prefixed logs
   - Check for errors in API responses

3. **Check OneSignal dashboard**
   - Go to Messages section
   - Look at delivery status
   - Check failure reasons in logs

4. **Verify business_id tag**
   - OneSignal needs `business_id` tag set for device
   - Check that notification filter matches: `tag:business_id equals <business-id>`

5. **Test in non-Median browser**
   - Regular browser should not crash
   - Should silently skip OneSignal init
   - Dashboard should work normally

6. **Check API endpoints**
   - Test `/api/save-push-token` - should return 200
   - Test `/api/notifications/send-order` - should return 200
   - Check API response for error messages

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| "OneSignal not configured" error | Add `NEXT_PUBLIC_ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY` to environment |
| Notifications not appearing | Check OneSignal dashboard, verify business_id tag set correctly |
| Notification tap not routing | Verify `window.medianOpenedPushNotification` callback is installed |
| Works in browser but not Median | Ensure Median app has JavaScript Bridge enabled and updated |
| Permission prompt not showing | Call `requestPushPermission()` manually after user action |
| Push token not saving | Check `/api/save-push-token` endpoint, verify user exists |

## Support Resources

- OneSignal Docs: https://documentation.onesignal.com/
- Median Docs: https://median.com/docs
- This Project Docs: `MEDIAN_ONESIGNAL_INTEGRATION.md`

## Contacts & Team

- OneSignal Account Manager: [Your contact]
- Median Support: [Your contact]
- Development Team: [Your team]

---

**Last Updated:** June 6, 2026
**Integration Version:** 1.0.0
