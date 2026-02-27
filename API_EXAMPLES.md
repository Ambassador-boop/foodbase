# FoodBase API Examples

Quick reference for common API calls and expected responses.

## Authentication APIs

### 1. Login
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "owner@example.com",
  "password": "password123"
}

# Response (201)
{
  "user": {
    "id": "usr_abc123",
    "email": "owner@example.com",
    "role": "business_owner"
  },
  "token": "eyJhbGc..."
}
```

### 2. Forgot Password - Request OTP
```bash
POST /api/auth/forgot-password
Content-Type: application/json

{
  "email": "owner@example.com"
}

# Response (200)
{
  "message": "OTP sent to email"
}
```

### 3. Reset Password with OTP
```bash
POST /api/auth/reset-password
Content-Type: application/json

{
  "email": "owner@example.com",
  "otp": "123456",
  "new_password": "newpassword123"
}

# Response (200)
{
  "message": "Password reset successful"
}
```

---

## Business Owner APIs

### 1. Get Business Info
```bash
GET /api/business
Authorization: Bearer {token}

# Response (200)
{
  "id": "biz_xyz789",
  "name": "The Golden Fork",
  "slug": "the-golden-fork",
  "logo_url": "https://cloudinary.com/...",
  "email": "owner@example.com",
  "phone": "08012345678",
  "address": "123 Main Street",
  "available_balance": 250000,
  "pending_balance": 50000
}
```

### 2. Create Menu Item
```bash
POST /api/business/menu-items
Authorization: Bearer {token}
Content-Type: application/json

{
  "category_id": "cat_abc123",
  "name": "Jollof Rice with Chicken",
  "description": "Aromatic jollof rice with grilled chicken",
  "price": 2500,
  "image_url": "https://cloudinary.com/...",
  "is_available": true
}

# Response (201)
{
  "id": "itm_menu123",
  "category_id": "cat_abc123",
  "name": "Jollof Rice with Chicken",
  "price": 2500,
  "image_url": "https://cloudinary.com/...",
  "created_at": "2026-02-27T12:00:00Z"
}
```

### 3. Create Add-on
```bash
POST /api/business/addons
Authorization: Bearer {token}
Content-Type: application/json

{
  "category": "Proteins",
  "name": "Extra Chicken",
  "price": 500
}

# Response (201)
{
  "id": "add_protein001",
  "category": "Proteins",
  "name": "Extra Chicken",
  "price": 500,
  "created_at": "2026-02-27T12:00:00Z"
}
```

### 4. Get Orders
```bash
GET /api/business/orders?status=pending&limit=20&offset=0
Authorization: Bearer {token}

# Response (200)
[
  {
    "id": "ord_customer001",
    "customer_phone": "08087654321",
    "items": [
      {
        "id": "itm_menu123",
        "name": "Jollof Rice with Chicken",
        "quantity": 2,
        "price": 2500,
        "addons": [
          {
            "id": "add_protein001",
            "name": "Extra Chicken",
            "price": 500
          }
        ]
      }
    ],
    "subtotal": 6500,
    "tax": 650,
    "total": 7150,
    "status": "pending",
    "created_at": "2026-02-27T13:45:00Z"
  }
]
```

### 5. Get Transactions
```bash
GET /api/business/transactions?type=income&startDate=2026-02-01&endDate=2026-02-27
Authorization: Bearer {token}

# Response (200)
[
  {
    "id": "txn_001",
    "type": "income",
    "amount": 7150,
    "description": "Order payment received",
    "reference": "PSK_ref_123456",
    "created_at": "2026-02-27T13:45:00Z"
  }
]
```

### 6. Submit Withdrawal
```bash
POST /api/business/withdrawals
Authorization: Bearer {token}
Content-Type: application/json

{
  "amount": 100000
}

# Response (201)
{
  "id": "wd_withdraw001",
  "amount": 100000,
  "status": "pending",
  "available_date": "2026-02-28",
  "created_at": "2026-02-27T14:00:00Z"
}
```

### 7. Update Bank Details
```bash
POST /api/business/bank-details
Authorization: Bearer {token}
Content-Type: application/json

{
  "bank_name": "Access Bank",
  "bank_account_number": "0123456789",
  "account_holder_name": "John Doe"
}

# Response (200)
{
  "message": "Bank details updated"
}
```

---

## Public APIs

### 1. Get Restaurant Menu
```bash
GET /api/restaurants/the-golden-fork/menu

# Response (200)
{
  "business": {
    "id": "biz_xyz789",
    "name": "The Golden Fork",
    "logo_url": "https://cloudinary.com/...",
    "slug": "the-golden-fork"
  },
  "categories": [
    {
      "id": "cat_abc123",
      "name": "Main Dishes",
      "items": [
        {
          "id": "itm_menu123",
          "name": "Jollof Rice with Chicken",
          "price": 2500,
          "image_url": "https://cloudinary.com/...",
          "description": "Aromatic jollof rice with grilled chicken"
        }
      ]
    }
  ],
  "addons": [
    {
      "id": "add_protein001",
      "category": "Proteins",
      "name": "Extra Chicken",
      "price": 500
    }
  ],
  "popular_dishes": [
    {
      "id": "itm_menu123",
      "name": "Jollof Rice with Chicken",
      "featured_image_url": "https://cloudinary.com/...",
      "order_count": 45
    }
  ]
}
```

---

## Payment APIs

### 1. Initialize Paystack Payment
```bash
POST /api/payments/initialize
Content-Type: application/json

{
  "slug": "the-golden-fork",
  "order_id": "ord_customer001",
  "amount": 7150,
  "email": "owner@example.com"
}

# Response (200)
{
  "authorization_url": "https://checkout.paystack.com/...",
  "access_code": "access_code_xyz",
  "reference": "PSK_ref_123456"
}
```

### 2. Verify Payment
```bash
POST /api/payments/verify
Content-Type: application/json

{
  "reference": "PSK_ref_123456"
}

# Response (200)
{
  "status": "success",
  "amount": 715000,
  "customer": {
    "email": "owner@example.com"
  },
  "order_id": "ord_customer001"
}
```

---

## Admin APIs

### 1. Register Business
```bash
POST /api/admin/businesses/register
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "owner_email": "newowner@example.com",
  "business_name": "Restaurant Name",
  "business_slug": "restaurant-slug",
  "phone": "08012345678",
  "address": "123 Business Street",
  "city": "Lagos",
  "state": "Lagos",
  "country": "Nigeria",
  "logo_url": "https://cloudinary.com/..."
}

# Response (201)
{
  "business": {
    "id": "biz_new123",
    "name": "Restaurant Name",
    "slug": "restaurant-slug",
    "owner_id": "usr_newowner"
  },
  "credentials": {
    "email": "newowner@example.com",
    "temporary_password": "TempPass123!"
  }
}
```

### 2. Get All Businesses
```bash
GET /api/admin/businesses?status=active&limit=20&offset=0
Authorization: Bearer {admin_token}

# Response (200)
[
  {
    "id": "biz_xyz789",
    "name": "The Golden Fork",
    "owner_email": "owner@example.com",
    "slug": "the-golden-fork",
    "status": "active",
    "created_at": "2026-02-01T10:00:00Z",
    "total_orders": 156,
    "total_revenue": 1250000
  }
]
```

---

## Webhook Handling

### Paystack Webhook Signature Verification
```typescript
import crypto from 'crypto';

function verifyPaystackSignature(signature: string, body: string): boolean {
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY!)
    .update(body)
    .digest('hex');
  
  return hash === signature;
}
```

### Webhook Event Structure
```json
{
  "event": "charge.success",
  "data": {
    "id": 1234567890,
    "reference": "PSK_ref_123456",
    "amount": 715000,
    "paid_at": "2026-02-27T14:00:00Z",
    "customer": {
      "id": 98765,
      "email": "owner@example.com"
    }
  }
}
```

---

## Error Responses

### Common Error Codes
```json
{
  "400": {
    "error": "Missing required fields"
  },
  "401": {
    "error": "Unauthorized - Invalid or missing token"
  },
  "403": {
    "error": "Forbidden - Insufficient permissions"
  },
  "404": {
    "error": "Resource not found"
  },
  "500": {
    "error": "Internal server error"
  }
}
```

---

## Testing with cURL

### Login Test
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "owner@example.com",
    "password": "password123"
  }'
```

### Get Business Info
```bash
curl -X GET http://localhost:3000/api/business \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### Create Menu Item
```bash
curl -X POST http://localhost:3000/api/business/menu-items \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "category_id": "cat_abc123",
    "name": "Jollof Rice",
    "price": 2500,
    "image_url": "https://..."
  }'
```

---

## Rate Limiting
- OTP requests: 3 per email per hour
- Login attempts: 5 per email per 15 minutes
- Withdrawal requests: 10 per day per business
- API requests: General 100 per minute per IP

---

For more detailed endpoint documentation, refer to SETUP.md
