-- Create notifications table for OneSignal integration
CREATE TABLE notifications (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  business_id VARCHAR NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id VARCHAR NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  onesignal_notification_id VARCHAR UNIQUE,
  customer_name VARCHAR NOT NULL,
  payment_status VARCHAR NOT NULL,
  notification_title VARCHAR NOT NULL,
  notification_body TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_business_id ON notifications(business_id);
CREATE INDEX idx_notifications_order_id ON notifications(order_id);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);

-- Add notification_id column to orders for tracking
ALTER TABLE orders ADD COLUMN IF NOT EXISTS onesignal_notification_id VARCHAR;
