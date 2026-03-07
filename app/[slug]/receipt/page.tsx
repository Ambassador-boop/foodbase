'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, MapPin, Phone } from 'lucide-react';

interface OrderDetails {
  id: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    addons: string[];
  }>;
  subtotal: number;
  tax: number;
  total: number;
  customer_name?: string;
  customer_phone?: string;
  status: string;
  created_at: string;
}

export default function ReceiptPage({ params }: { params: { slug: string } }) {
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const orderId = searchParams.get('orderId');

  useEffect(() => {
    if (orderId) {
      // Mock order data - in production, fetch from API
      setOrder({
        id: orderId,
        items: [
          { name: 'Jollof Rice', quantity: 2, price: 2500, addons: ['Chicken +500'] },
          { name: 'Spaghetti', quantity: 1, price: 2000, addons: ['Beef +800', 'Salad +300'] },
        ],
        subtotal: 8600,
        tax: 860,
        total: 9460,
        customer_name: 'John Doe',
        customer_phone: '08012345678',
        status: 'paid',
        created_at: new Date().toISOString(),
      });
      setLoading(false);
    }
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Clock className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
          <p className="text-sm text-muted-foreground">Loading receipt...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-4">Order not found</p>
          <Link href={`/${params.slug}`}>
            <Button className="text-xs h-8">Back to Menu</Button>
          </Link>
        </div>
      </div>
    );
  }

  const estimatedTime = new Date(new Date(order.created_at).getTime() + 30 * 60000);

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-6 py-4 border-b border-border">
          <CheckCircle className="w-10 h-10 text-accent mx-auto mb-3" />
          <h1 className="text-lg font-bold mb-1">Order Confirmed</h1>
          <p className="text-xs text-muted-foreground">Thank you for your order</p>
        </div>

        {/* Order Number - Prominently Displayed */}
        <div className="bg-primary text-white p-6 rounded-lg mb-6 text-center">
          <p className="text-xs text-white/80 mb-2">Order Number</p>
          <p className="text-3xl font-bold font-mono mb-2">{order.id}</p>
          <p className="text-xs text-white/70">Keep this for your reference</p>
        </div>

        {/* Order Number and Time */}
        <div className="bg-primary/5 p-4 rounded mb-4 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Order ID:</span>
            <span className="font-mono font-semibold">{order.id}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Estimated Ready:</span>
            <span className="font-semibold">{estimatedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Status:</span>
            <span className="px-2 py-1 bg-accent/20 text-accent rounded text-xs font-medium capitalize">
              {order.status}
            </span>
          </div>
        </div>

        {/* Order Items */}
        <div className="mb-4 border border-border rounded p-4">
          <h2 className="text-sm font-semibold mb-3">Order Details</h2>
          <div className="space-y-3">
            {order.items.map((item, idx) => (
              <div key={idx} className="text-xs">
                <div className="flex justify-between mb-1">
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-muted-foreground">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-semibold">₦{(item.price * item.quantity).toLocaleString()}</p>
                </div>
                {item.addons.length > 0 && (
                  <div className="ml-2 text-muted-foreground space-y-0.5">
                    {item.addons.map((addon, addonIdx) => (
                      <p key={addonIdx} className="text-xs">• {addon}</p>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Pricing Breakdown */}
        <div className="border border-border rounded p-4 mb-4 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal:</span>
            <span>₦{order.subtotal.toLocaleString()}</span>
          </div>
          <div className="flex justify-between pb-2 border-b border-border">
            <span className="text-muted-foreground">Tax (10%):</span>
            <span>₦{order.tax.toLocaleString()}</span>
          </div>
          <div className="flex justify-between font-semibold text-sm">
            <span>Total Paid:</span>
            <span className="text-primary">₦{order.total.toLocaleString()}</span>
          </div>
        </div>

        {/* Customer Info */}
        {order.customer_name && (
          <div className="bg-accent/5 p-4 rounded mb-6 space-y-2 text-xs">
            <div className="flex gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-muted-foreground">Customer Name</p>
                <p className="font-semibold">{order.customer_name}</p>
              </div>
            </div>
            {order.customer_phone && (
              <div className="flex gap-2">
                <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-muted-foreground">Phone</p>
                  <p className="font-semibold">{order.customer_phone}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <Link href={`/${params.slug}`} className="flex-1">
            <Button variant="outline" className="w-full h-9 text-xs">
              Continue Shopping
            </Button>
          </Link>
          <Button className="flex-1 h-9 text-xs bg-primary text-white hover:bg-primary-dark">
            Print Receipt
          </Button>
        </div>

        {/* Footer Note */}
        <p className="text-xs text-muted-foreground text-center mt-6 pt-4 border-t border-border">
          A confirmation has been sent to the restaurant. Your order will be ready soon.
        </p>
      </div>
    </div>
  );
}
