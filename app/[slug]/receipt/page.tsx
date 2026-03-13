'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { CheckCircle, Clock, MapPin, Phone, AlertCircle } from 'lucide-react';

interface OrderItem {
  id: string;
  menu_item_id: string;
  menu_item_name: string;
  menu_item_description?: string;
  menu_item_image?: string;
  quantity: number;
  item_price: number;
  addons: Array<{
    id: string;
    name: string;
    price: number;
    image_url?: string;
  }>;
}

interface OrderData {
  order: {
    id: string;
    business_id: string;
    business_name: string;
    logo_url?: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    address: string;
    status: string;
    payment_status: string;
    notes?: string;
    created_at: string;
    completed_at?: string;
  };
  items: OrderItem[];
  calculations: {
    subtotal: number;
    serviceFee: number;
    total: number;
  };
}

export default function ReceiptPage({ params }: { params: { slug: string } }) {
  const searchParams = useSearchParams();
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const orderId = searchParams.get('orderId');

  useEffect(() => {
    if (orderId) {
      fetchOrderData();
    } else {
      setError('Order ID not found');
      setLoading(false);
    }
  }, [orderId]);

  const fetchOrderData = async () => {
    try {
      console.log('[v0] Receipt: Fetching order data for orderId:', orderId);
      const response = await fetch(`/api/orders/${orderId}`);

      console.log('[v0] Receipt: API response status:', response.status);
      console.log('[v0] Receipt: API response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('[v0] Receipt: API error response:', errorData);
        throw new Error(errorData.error || 'Failed to fetch order');
      }

      const data = await response.json();
      console.log('[v0] Receipt: Order data received:', data);
      setOrderData(data);
    } catch (err) {
      console.error('[v0] Receipt: Error fetching order:', err);
      setError('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(num);
  };

  const getAddonQuantity = (addons: OrderItem['addons'], addonId: string): number => {
    return addons.filter((a) => a.id === addonId).length;
  };

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

  if (error || !orderData) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
          <p className="text-sm text-muted-foreground mb-4">{error}</p>
          <Link href={`/${params.slug}`}>
            <Button className="text-xs h-8">Back to Menu</Button>
          </Link>
        </div>
      </div>
    );
  }

  const estimatedTime = new Date(
    new Date(orderData.order.created_at).getTime() + 30 * 60000
  );

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-6 py-4 border-b border-border">
          <CheckCircle className="w-10 h-10 text-accent mx-auto mb-3" />
          <h1 className="text-lg font-bold mb-1">Order Confirmed</h1>
          <p className="text-xs text-muted-foreground">Thank you for your order</p>
        </div>

        {/* Order Number */}
        <div className="bg-primary text-white p-6 rounded-lg mb-6 text-center">
          <p className="text-xs text-white/80 mb-2">Order Number</p>
          <p className="text-3xl font-bold font-mono mb-2">{orderData.order.id}</p>
          <p className="text-xs text-white/70">Keep this for your reference</p>
        </div>

        {/* Order Info */}
        <div className="bg-primary/5 p-4 rounded mb-4 space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Estimated Ready:</span>
            <span className="font-semibold">
              {estimatedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Status:</span>
            <span className="px-2 py-1 bg-accent/20 text-accent rounded text-xs font-medium capitalize">
              {orderData.order.status}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Payment:</span>
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium capitalize">
              {orderData.order.payment_status}
            </span>
          </div>
        </div>

        {/* Order Items */}
        <div className="mb-4 border border-border rounded p-4 space-y-4">
          <h2 className="text-sm font-semibold">Order Details</h2>

          {orderData.items.map((item, idx) => {
            const hasAddons = item.addons && item.addons.length > 0;
            const perUnitPrice = item.item_price / item.quantity;
            const addonsTotal = item.addons?.reduce((sum, addon) => sum + addon.price, 0) || 0;

            return (
              <div key={idx} className="border-b border-border pb-4 last:border-b-0 last:pb-0">
                {/* Menu Item with Image */}
                <div className="flex gap-3 mb-3">
                  {item.menu_item_image && (
                    <div className="relative w-16 h-16 rounded overflow-hidden flex-shrink-0">
                      <Image
                        src={item.menu_item_image}
                        alt={item.menu_item_name}
                        fill
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <h3 className="font-semibold text-sm">{item.menu_item_name}</h3>
                    {item.menu_item_description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{item.menu_item_description}</p>
                    )}
                    <div className="flex justify-between items-end mt-1">
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                      <p className="text-xs font-semibold">
                        {formatCurrency(perUnitPrice)} {item.quantity > 1 && `× ${item.quantity}`}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Addons */}
                {hasAddons && (
                  <div className="ml-3 space-y-2 border-l-2 border-border pl-3">
                    <p className="text-xs font-medium text-muted-foreground">Add-ons:</p>
                    {/* Deduplicate addons for display */}
                    {Array.from(new Set(item.addons.map((a) => a.id))).map((addonId) => {
                      const addon = item.addons.find((a) => a.id === addonId);
                      const quantity = getAddonQuantity(item.addons, addonId);
                      if (!addon) return null;

                      return (
                        <div key={addonId} className="space-y-1">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <p className="text-xs">
                                {addon.name}
                                {quantity > 1 && <span className="text-muted-foreground ml-1">× {quantity}</span>}
                              </p>
                            </div>
                            <p className="text-xs font-medium text-muted-foreground">
                              +{formatCurrency(addon.price * quantity)}
                            </p>
                          </div>
                          {addon.image_url && (
                            <div className="relative w-12 h-12 rounded overflow-hidden mt-1">
                              <Image
                                src={addon.image_url}
                                alt={addon.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Item Total */}
                <div className="flex justify-between pt-2 border-t border-border mt-2">
                  <span className="text-xs font-semibold">Item Total:</span>
                  <span className="text-xs font-bold">
                    {formatCurrency((perUnitPrice + addonsTotal) * item.quantity)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pricing Breakdown */}
        <div className="border border-border rounded p-4 mb-4 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal:</span>
            <span>{formatCurrency(orderData.calculations.subtotal)}</span>
          </div>
          <div className="flex justify-between pb-2 border-b border-border">
            <span className="text-muted-foreground">Service Fee (7.5%):</span>
            <span>+{formatCurrency(orderData.calculations.serviceFee)}</span>
          </div>
          <div className="flex justify-between font-semibold text-sm">
            <span>Total Paid:</span>
            <span className="text-primary">{formatCurrency(orderData.calculations.total)}</span>
          </div>
        </div>

        {/* Customer Info */}
        <div className="bg-accent/5 p-4 rounded mb-6 space-y-2 text-xs">
          <div className="flex gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-muted-foreground">Customer Name</p>
              <p className="font-semibold">{orderData.order.customer_name}</p>
            </div>
          </div>
          {orderData.order.customer_phone && (
            <div className="flex gap-2">
              <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-muted-foreground">Phone</p>
                <p className="font-semibold">{orderData.order.customer_phone}</p>
              </div>
            </div>
          )}
          {orderData.order.address && (
            <div className="flex gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-muted-foreground">Delivery Address</p>
                <p className="font-semibold text-xs">{orderData.order.address}</p>
              </div>
            </div>
          )}
          {orderData.order.notes && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-muted-foreground">Special Instructions:</p>
              <p className="font-semibold text-xs mt-1">{orderData.order.notes}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link href={`/${params.slug}`} className="flex-1">
            <Button variant="outline" className="w-full h-9 text-xs">
              Continue Shopping
            </Button>
          </Link>
          <Button
            onClick={() => window.print()}
            className="flex-1 h-9 text-xs bg-primary text-white hover:bg-primary-dark"
          >
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
