# OneSignal + Median Integration - Documentation Index

Welcome! This document guides you to the right documentation for your needs.

---

## 🚀 I Want to Get Started NOW (5 minutes)

**→ Read:** `GET_STARTED.md`

This guide includes:
- Copy-paste environment variables setup
- Dashboard component code
- Notification endpoint calls
- Quick testing instructions

---

## 📖 I Need Complete Setup Instructions

**→ Read:** `ONESIGNAL_SETUP_CHECKLIST.md`

This guide includes:
- Step-by-step setup with verification
- Environment variable configuration
- OneSignal app configuration
- Testing procedures
- Median app setup
- Production deployment
- Troubleshooting matrix

---

## 🔍 I Want to Understand How It Works

**→ Read:** `FLOW_DIAGRAMS.md`

This guide includes:
- 8 detailed flow diagrams
- Login flow visualization
- Order notification flow
- Status update flow
- Notification tap handling
- Complete architecture diagram
- Data flow diagram

---

## 📚 I Need Complete Technical Documentation

**→ Read:** `MEDIAN_ONESIGNAL_INTEGRATION.md`

This guide includes:
- Complete architecture overview
- Detailed API documentation
- Setup instructions
- Notification payload structure
- Best practices
- Security considerations
- Troubleshooting guide
- Database schema info

---

## 🎯 I Need Quick API Reference

**→ Read:** `ONESIGNAL_QUICK_REFERENCE.md`

This guide includes:
- Core API functions
- All endpoints
- Code examples
- Common issues & solutions
- Usage patterns
- File reference

---

## ✨ What Was Implemented?

**→ Read:** `IMPLEMENTATION_SUMMARY.md`

This guide includes:
- Complete feature list
- All files created/modified
- Integration points
- Security features
- Production readiness info

---

## 📋 What Do I Need to Do?

**→ Read:** `DELIVERY_SUMMARY.md`

This guide includes:
- Project overview
- Quick start (5 minutes)
- Integration points
- Testing checklist
- Production checklist
- Quality assurance info

---

## 🎓 Documentation Map

```
START HERE
    ↓
┌─────────────────────────────────────────────┐
│          GET_STARTED.md                     │
│   Quick 5-minute setup guide                │
│   Best for: Immediate integration           │
└─────────────┬───────────────────────────────┘
              │
        ┌─────┴──────┬──────────┬────────┐
        ↓            ↓          ↓        ↓
    ┌────────┐   ┌──────┐  ┌────────┐  ┌──────────┐
    │SETUP   │   │DIAGRAMS│REFERENCE│  │FULL DOCS │
    │CHECKLIST├───┤(visual)├──(API)────┤(technical)
    └────────┘   └──────┘  └────────┘  └──────────┘
        │            │          │           │
        │            │          │           │
    Testing   Understanding  Quick  Complete
   procedures   how it works  lookup  deep dive
```

---

## 📁 Files Structure

### Core Implementation
- `lib/median-bridge.ts` - Median bridge utilities
- `lib/median-notification-handler.ts` - Notification handler
- `components/dashboard/median-notification-setup.tsx` - Setup component
- `app/api/save-push-token/route.ts` - Save device token
- `app/api/orders/notify/route.ts` - Manual notification trigger
- `app/api/notifications/send-order/route.ts` - (Enhanced)
- `app/api/notifications/update-order-status/route.ts` - (Enhanced)

### Documentation
1. **GET_STARTED.md** ← Start here!
2. **ONESIGNAL_SETUP_CHECKLIST.md** ← Complete setup guide
3. **FLOW_DIAGRAMS.md** ← Visual explanations
4. **ONESIGNAL_QUICK_REFERENCE.md** ← API reference
5. **MEDIAN_ONESIGNAL_INTEGRATION.md** ← Full technical docs
6. **IMPLEMENTATION_SUMMARY.md** ← Feature list
7. **DELIVERY_SUMMARY.md** ← What was delivered
8. **ONESIGNAL_INDEX.md** ← This file

---

## 🎯 By Use Case

### I'm a Project Manager
→ Read `DELIVERY_SUMMARY.md` for overview  
→ Read `IMPLEMENTATION_SUMMARY.md` for details  
→ Share `GET_STARTED.md` with developers

### I'm a Developer Setting Up
→ Start with `GET_STARTED.md` (5 min)  
→ Use `ONESIGNAL_SETUP_CHECKLIST.md` (thorough)  
→ Reference `ONESIGNAL_QUICK_REFERENCE.md` while coding

### I'm a Developer Learning the System
→ Read `FLOW_DIAGRAMS.md` (understand flow)  
→ Read `MEDIAN_ONESIGNAL_INTEGRATION.md` (deep dive)  
→ Use `ONESIGNAL_QUICK_REFERENCE.md` as reference

### I'm Debugging an Issue
→ Check `ONESIGNAL_SETUP_CHECKLIST.md` troubleshooting  
→ Review `ONESIGNAL_QUICK_REFERENCE.md` common issues  
→ Check `FLOW_DIAGRAMS.md` for architecture  
→ Reference `MEDIAN_ONESIGNAL_INTEGRATION.md` for details

### I'm Going to Production
→ Read `ONESIGNAL_SETUP_CHECKLIST.md` production section  
→ Use `DELIVERY_SUMMARY.md` production checklist  
→ Reference `MEDIAN_ONESIGNAL_INTEGRATION.md` security section

---

## ⏱️ Time Investment

| Document | Time | Best For |
|----------|------|----------|
| GET_STARTED.md | 5 min | Quick setup |
| ONESIGNAL_SETUP_CHECKLIST.md | 30 min | Thorough setup + testing |
| FLOW_DIAGRAMS.md | 10 min | Understanding flow |
| ONESIGNAL_QUICK_REFERENCE.md | 10 min | API lookup |
| MEDIAN_ONESIGNAL_INTEGRATION.md | 20 min | Technical deep dive |
| IMPLEMENTATION_SUMMARY.md | 10 min | Feature overview |
| DELIVERY_SUMMARY.md | 10 min | Project summary |

**Total for full understanding:** ~95 minutes  
**Total for basic setup:** ~35 minutes  
**Total for quick start:** ~5 minutes  

---

## 🔑 Key Concepts

### Median Environment
- Detection: Check `window.median?.isNativeApp`
- Bridge: Access native features via `window.median.onesignal`
- Fallback: Gracefully works in regular browsers

### OneSignal Integration
- External ID: User email (safe identifier)
- Segmentation: Business owner targeting via tags
- Payload: Rich order details for notifications

### Notification Flow
1. Order created → API called
2. Backend fetches order details
3. OneSignal sends notification
4. Business owner receives notification
5. Tap notification → Navigate to order details

### Device Token Management
- Stored after login
- Saved to backend for audit
- Used for OneSignal segmentation
- Cleared on logout

---

## ✅ Quick Verification

### Environment Variables Set?
```bash
# Should show both:
echo $NEXT_PUBLIC_ONESIGNAL_APP_ID
echo $ONESIGNAL_REST_API_KEY
```

### Component Integrated?
```bash
# Check dashboard layout has:
grep -r "MedianNotificationSetup" app/dashboard/
```

### Endpoints Working?
```bash
# Test order notification:
curl -X POST http://localhost:3000/api/notifications/send-order \
  -H "Content-Type: application/json" \
  -d '{"orderId":"test","businessId":"test"}'
```

### In Median App?
- Check browser console for `[v0]` logs
- Should show OneSignal initialization
- Tap notification should navigate

---

## 🆘 Stuck? Here's Help

**Setup Issues**
→ Check `ONESIGNAL_SETUP_CHECKLIST.md` → Troubleshooting

**API Questions**
→ Check `ONESIGNAL_QUICK_REFERENCE.md` → API Endpoints

**Architecture Questions**
→ Check `FLOW_DIAGRAMS.md` → Relevant diagram

**Technical Deep Dive**
→ Check `MEDIAN_ONESIGNAL_INTEGRATION.md` → Relevant section

**What's Implemented**
→ Check `IMPLEMENTATION_SUMMARY.md` → Feature list

---

## 📞 Support Contacts

- OneSignal Help: https://onesignal.com/support
- Median Help: https://median.com/support
- Your Team: [contact info]

---

## 🎉 Ready?

**Start here:** `GET_STARTED.md` (5 minutes)

Then integrate the notification endpoints into your order flow, test in the Median app, and you're done!

**All documentation is available in your project root.** 📚

---

**Last Updated:** June 6, 2026  
**Status:** ✅ Complete and Ready  
**Questions?** See the document that matches your use case above
