# OneSignal + Median Integration - Flow Diagrams

## 1. User Login Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ BROWSER / MEDIAN APP                                             │
└─────────────────────────────────────────────────────────────────┘

User Opens App
    │
    ├─→ Check if Median environment
    │   └─→ isMedianEnvironment() 
    │
    ├─→ User enters credentials
    │
    ├─→ POST /api/auth/login
    │   ├─→ Validate email/password
    │   ├─→ Get user from database
    │   ├─→ Create JWT token
    │   └─→ Return user data
    │
    ├─→ Frontend receives: { user, token, redirectUrl }
    │
    ├─→ IF Median environment:
    │   │
    │   ├─→ initializeOneSignalFlow(user.email)
    │   │   │
    │   │   ├─→ median.onesignal.login(user@email.com)
    │   │   │   └─→ OneSignal associates device with email
    │   │   │
    │   │   ├─→ getOneSignalInfo()
    │   │   │   └─→ Returns { oneSignalUserId, externalId }
    │   │   │
    │   │   ├─→ POST /api/save-push-token
    │   │   │   └─→ Backend stores token association
    │   │   │
    │   │   └─→ setupMedianNotificationHandler(router)
    │   │       └─→ Installs window.medianOpenedPushNotification
    │   │
    │   └─→ User can now receive notifications
    │
    └─→ Navigate to /dashboard
        └─→ Dashboard renders and shows orders
```

## 2. New Order Notification Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND / PAYMENT PROCESSOR                                      │
└─────────────────────────────────────────────────────────────────┘

Customer Places Order
    │
    ├─→ POST /api/orders
    │   └─→ Create order record in database
    │
    ├─→ Customer pays
    │   └─→ Payment processor webhook
    │
    ├─→ Payment confirmed
    │
    ├─→ POST /api/notifications/send-order
    │   │
    │   ├─→ Validate orderId and businessId
    │   │
    │   ├─→ Fetch order details:
    │   │   ├─→ SELECT * FROM orders WHERE id = $1
    │   │   │   └─→ Get: customer_name, email, phone, payment_status, total_amount, address
    │   │   │
    │   │   └─→ SELECT * FROM order_items JOIN menu_items
    │   │       └─→ Get: items, quantities, prices
    │   │
    │   ├─→ Build notification payload:
    │   │   ├─→ Title: "New Order from John Doe"
    │   │   ├─→ Body: "Order #abc123 - Burger x1, Fries x2 - Paid"
    │   │   └─→ Data: { orderId, type, targetUrl, customerName, payment_status, total_amount }
    │   │
    │   ├─→ POST OneSignal /notifications API
    │   │   ├─→ Filter: tag:business_id = business-456
    │   │   └─→ OneSignal queues notification for delivery
    │   │
    │   ├─→ INSERT INTO notifications table
    │   │   └─→ Store: notification_id, order_id, customer_name, payment_status, etc.
    │   │
    │   └─→ Return { success: true, notificationId }
    │
    └─→ Business owner's Median app
        ├─→ OneSignal Service receives notification
        ├─→ Displays push notification on device
        └─→ User sees: "New Order from John Doe"
```

## 3. Order Status Update Notification Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ BUSINESS DASHBOARD / POINT OF SALE                               │
└─────────────────────────────────────────────────────────────────┘

Business Owner Updates Order
    │
    ├─→ PUT /api/orders/[orderId]/status
    │   ├─→ Update order.status = "preparing"
    │   └─→ Save to database
    │
    ├─→ Trigger notification:
    │   └─→ POST /api/notifications/update-order-status
    │       │
    │       ├─→ Fetch order details (same as new order)
    │       │
    │       ├─→ Build status update notification:
    │       │   ├─→ Title: "Order Status Update"
    │       │   ├─→ Body: "Order #abc123 - Being Prepared - Paid"
    │       │   ├─→ Status display: pending→"Pending", preparing→"Being Prepared", etc.
    │       │   └─→ Data: { orderId, status, paymentStatus, type: "order_status_update" }
    │       │
    │       ├─→ Create NEW notification (not update existing)
    │       │   └─→ One notification per status change
    │       │
    │       ├─→ POST OneSignal /notifications API
    │       │   └─→ Send to same business_id
    │       │
    │       ├─→ INSERT INTO notifications table
    │       │   └─→ Store new notification record
    │       │
    │       └─→ Return { success: true }
    │
    └─→ Business owner receives notification
        └─→ "Order #abc123 - Being Prepared - Paid"
```

## 4. Notification Tap & Routing Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ MEDIAN APP - USER TAPS NOTIFICATION                              │
└─────────────────────────────────────────────────────────────────┘

Notification appears on device
    │
    └─→ User taps notification
        │
        ├─→ Median app captures tap
        │
        ├─→ Extract notification payload:
        │   ├─→ orderId: "order-123"
        │   ├─→ type: "new_order" or "order_status_update"
        │   ├─→ targetUrl: "/dashboard/orders/order-123"
        │   └─→ customerName, paymentStatus, etc.
        │
        ├─→ Call window.medianOpenedPushNotification(payload)
        │   │
        │   └─→ setupMedianNotificationHandler installed this callback
        │
        ├─→ Handler parses payload:
        │   │
        │   └─→ If orderId exists:
        │       ├─→ Route: /dashboard/orders/[orderId]
        │       └─→ router.push("/dashboard/orders/order-123")
        │
        ├─→ Next.js navigates to order detail page
        │   │
        │   ├─→ Fetch order details from database
        │   ├─→ Fetch order items and menu details
        │   └─→ Render complete order view
        │
        └─→ User sees full order details
            ├─→ Customer name
            ├─→ Order ID and timestamp
            ├─→ Menu items with quantities and prices
            ├─→ Order total
            ├─→ Payment status
            ├─→ Delivery address (if applicable)
            └─→ Current order status
```

## 5. Complete Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER / MEDIAN APP                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────┐          ┌──────────────────────────────┐   │
│  │  Login Page     │          │  Dashboard Layout            │   │
│  │                 │          │                              │   │
│  │ Email/Password  │────────→ │  <MedianNotificationSetup>   │   │
│  │                 │          │      ↓                       │   │
│  │ Submit Login    │          │  window.medianOpenedPush...  │   │
│  └────────┬────────┘          └──────────────────────────────┘   │
│           │                                                       │
│           ├─→ lib/median-bridge.ts                               │
│           │   ├─→ isMedianEnvironment()                          │
│           │   ├─→ initOneSignal(email)                           │
│           │   ├─→ getOneSignalInfo()                             │
│           │   └─→ requestPushPermission()                        │
│           │                                                       │
│           └─→ lib/median-notification-handler.ts                 │
│               └─→ setupMedianNotificationHandler()               │
│                                                                   │
└───────────────┬───────────────────────────────────────────────────┘
                │
                │ HTTP/HTTPS
                ↓
    ┌──────────────────────────────────────────────────┐
    │          NEXT.JS BACKEND / API ROUTES            │
    ├──────────────────────────────────────────────────┤
    │                                                  │
    │  /api/auth/login ─────────────→ Database       │
    │     ├─ Validate credentials                      │
    │     └─ Return user data                          │
    │                                                  │
    │  /api/save-push-token ────────→ Database       │
    │     └─ Store device token                        │
    │                                                  │
    │  /api/notifications/send-order ─→ Database ─→ OneSignal   │
    │     ├─ Fetch order details                       │
    │     ├─ Build rich payload                        │
    │     └─ Send notification                         │
    │                                                  │
    │  /api/notifications/update-order-status         │
    │     └─ Same as above                             │
    │                                                  │
    │  /api/orders/notify ────────────────→ OneSignal │
    │     └─ Manual notification trigger               │
    │                                                  │
    └──────────────────────────────────────────────────┘
                │
         ┌──────┴──────┐
         ↓             ↓
    ┌─────────┐  ┌──────────────┐
    │ Neon    │  │  OneSignal   │
    │Database │  │ (REST API)   │
    │         │  │              │
    │Tables:  │  │ • Send       │
    │• users  │  │ • Segment    │
    │• orders │  │ • Filter     │
    │• order_ │  │ • Delivery   │
    │  items  │  │              │
    │• menu_  │  └──────┬───────┘
    │  items  │         │
    │• notif- │         └─→ Median App
    │  ications│     (Device Notification)
    └─────────┘
```

## 6. Data Flow Diagram

```
┌──────────────────────────────────┐
│   NEW ORDER CREATED              │
│                                  │
│ orders table:                    │
│ • id: "order-123"               │
│ • customer_name: "John Doe"      │
│ • customer_email: "john@..."     │
│ • payment_status: "paid"         │
│ • total_amount: 25.99            │
│ • business_id: "biz-456"         │
└──────────────┬───────────────────┘
               │
               ↓
┌──────────────────────────────────┐
│   order_items table              │
│                                  │
│ • order_id: "order-123"          │
│ • menu_item_id: "burger-1"       │
│ • quantity: 1                    │
│ • item_price: 12.99              │
│                                  │
│ • menu_item_id: "fries-2"        │
│ • quantity: 2                    │
│ • item_price: 4.50 (each)        │
└──────────────┬───────────────────┘
               │
               ↓
┌──────────────────────────────────┐
│   menu_items table               │
│                                  │
│ • id: "burger-1"                │
│ • name: "Classic Burger"         │
│ • price: 12.99                   │
│                                  │
│ • id: "fries-2"                  │
│ • name: "French Fries"           │
│ • price: 4.50                    │
└──────────────┬───────────────────┘
               │
               ↓
┌──────────────────────────────────────────────┐
│   NOTIFICATION PAYLOAD                       │
│                                              │
│ Title: "New Order from John Doe"             │
│ Body: "Order #abc123 - Classic Burger x1,   │
│        French Fries x2 - $25.99"             │
│                                              │
│ Data: {                                      │
│   orderId: "order-123",                      │
│   type: "new_order",                         │
│   targetUrl: "/dashboard/orders/order-123",  │
│   customerName: "John Doe",                  │
│   paymentStatus: "paid",                     │
│   totalAmount: "25.99",                      │
│   itemCount: "2"                             │
│ }                                            │
└──────────────┬───────────────────────────────┘
               │
               ↓
┌──────────────────────────────────┐
│   OneSignal Notification         │
│                                  │
│ • Segment: business_id = biz-456 │
│ • Delivery: Device               │
│ • Priority: 10 (high)            │
└──────────────┬───────────────────┘
               │
               ↓
┌──────────────────────────────────┐
│   notifications table (Audit)    │
│                                  │
│ • id: "notif-xyz"               │
│ • order_id: "order-123"          │
│ • business_id: "biz-456"         │
│ • notification_title: "..."      │
│ • notification_body: "..."       │
│ • onesignal_notification_id: ".."│
│ • payment_status: "paid"         │
│ • customer_name: "John Doe"      │
│ • is_read: false                 │
│ • created_at: now                │
└──────────────────────────────────┘
```

## 7. Environment & Configuration

```
┌────────────────────────────────────────────┐
│        ENVIRONMENT VARIABLES              │
├────────────────────────────────────────────┤
│                                            │
│ NEXT_PUBLIC_ONESIGNAL_APP_ID              │
│ └─ OneSignal app ID (public, in browser)  │
│    Used by: All notification requests     │
│                                            │
│ ONESIGNAL_REST_API_KEY                    │
│ └─ OneSignal REST API key (private)       │
│    Used by: Backend API routes only       │
│    Never sent to client                   │
│                                            │
└────────────────────────────────────────────┘
         │
         ├─→ Backend initializes with both
         │   └─→ Sends notifications via OneSignal API
         │
         └─→ Frontend uses public ID only
             └─→ Can integrate with OneSignal SDK if needed
```

## 8. Error Handling Flow

```
Any OneSignal Operation
    │
    ├─→ Check if Median environment
    │   ├─→ NO  → Log & return false (silent fail)
    │   └─→ YES → Continue
    │
    ├─→ Check env variables set
    │   ├─→ NO  → Log error & return 500
    │   └─→ YES → Continue
    │
    ├─→ Call Median bridge or OneSignal API
    │   ├─→ Success → Process response
    │   └─→ Error  → Log error details
    │
    ├─→ Try to store in database
    │   ├─→ Success → Record stored
    │   └─→ Error  → Log but don't fail request
    │              └─→ Notification sent even if DB fails
    │
    └─→ Return response
        ├─→ Success: { success: true, ... }
        └─→ Error: { error: "...", status: 400+ }
```

---

These diagrams provide a visual understanding of how the OneSignal + Median integration flows through your application.

For detailed implementation instructions, see `ONESIGNAL_SETUP_CHECKLIST.md`.
For complete documentation, see `MEDIAN_ONESIGNAL_INTEGRATION.md`.
