-- Create refunds table for Paystack refund tracking
CREATE TABLE refunds (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  business_id VARCHAR NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_id VARCHAR NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  transaction_id VARCHAR REFERENCES transactions(id),
  original_amount NUMERIC NOT NULL,
  refund_amount NUMERIC NOT NULL,
  paystack_refund_id VARCHAR UNIQUE,
  status VARCHAR DEFAULT 'pending', -- pending, success, failed, partial
  failure_reason TEXT,
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refunds_business_id ON refunds(business_id);
CREATE INDEX idx_refunds_order_id ON refunds(order_id);
CREATE INDEX idx_refunds_status ON refunds(status);
CREATE INDEX idx_refunds_created_at ON refunds(created_at DESC);
