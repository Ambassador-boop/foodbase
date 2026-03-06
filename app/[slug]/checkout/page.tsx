'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, ArrowLeft, Loader, MapPin, Home } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface Restaurant {
  id: string;
  name: string;
  email: string;
  phone?: string;
}

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [deliveryType, setDeliveryType] = useState<'restaurant' | 'delivery'>('restaurant');
  const [formData, setFormData] = useState({
    customerName: '',
    phone: '',
    address: '',
    notes: '',
  });

  const [loadingPage, setLoadingPage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    // Get cart from sessionStorage
    const storedCart = sessionStorage.getItem(`cart_${slug}`);
    if (storedCart) {
      try {
        const cartData = JSON.parse(storedCart);
        setCartItems(Array.isArray(cartData) ? cartData : []);
      } catch {
        setCartItems([]);
      }
    }

    // Fetch restaurant data
    const fetchRestaurant = async () => {
      try {
        const response = await fetch(`/api/restaurants/${slug}/menu`);
        const data = await response.json();
        setRestaurant(data.business);
      } catch (err) {
        console.error('Error fetching restaurant:', err);
      } finally {
        setLoadingPage(false);
      }
    };

    fetchRestaurant();
  }, [slug]);

  // Calculate totals
  const subtotal = cartItems.reduce((total, item) => {
    const itemPrice = item.price;
    const addonsPrice = item.addons?.reduce((sum: number, addon: any) => sum + addon.price, 0) || 0;
    return total + (itemPrice + addonsPrice) * item.quantity;
  }, 0);

  const deliveryFee = deliveryType === 'delivery' ? 1000 : 0;
  const cartTotal = subtotal + deliveryFee;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate form
    if (!formData.customerName.trim()) {
      setError('Customer name is required');
      return;
    }
    if (!formData.phone.trim()) {
      setError('Phone number is required');
      return;
    }
    if (deliveryType === 'delivery' && !formData.address.trim()) {
      setError('Delivery address is required');
      return;
    }
    if (cartItems.length === 0) {
      setError('Your cart is empty');
      return;
    }
    if (!restaurant) {
      setError('Restaurant information not available');
      return;
    }

    setLoading(true);

    try {
      // Create order
      const orderResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessSlug: slug,
          customerName: formData.customerName,
          phone: formData.phone,
          address: deliveryType === 'delivery' ? formData.address : 'At Restaurant',
          deliveryType,
          notes: formData.notes,
          items: cartItems,
          subtotal,
          deliveryFee,
          total: cartTotal,
        }),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        setError(orderData.error || 'Failed to create order');
        return;
      }

      // Initialize payment with business owner's email
      const paymentResponse = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: cartTotal,
          orderId: orderData.orderId,
          email: restaurant.email, // Use business email
          reference: orderData.reference,
        }),
      });

      const paymentData = await paymentResponse.json();

      if (!paymentResponse.ok) {
        setError(paymentData.error || 'Failed to initialize payment');
        return;
      }

      // Redirect to Paystack
      if (paymentData.authorizationUrl) {
        window.location.href = paymentData.authorizationUrl;
      } else {
        setError('Payment URL not available');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('[v0] Checkout error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loadingPage) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading checkout...</p>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-white border-b border-border sticky top-0 z-40">
          <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
            <Link href={`/${slug}`} className="p-1 hover:bg-muted rounded">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-bold">Checkout</h1>
          </div>
        </header>
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
          <p className="text-muted-foreground mb-4">Your cart is empty</p>
          <Link href={`/${slug}`}>
            <Button className="bg-primary text-white hover:bg-primary-dark">Continue Shopping</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/${slug}/cart`} className="p-1 hover:bg-muted rounded">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold">Checkout</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Order Summary */}
          <div className="bg-white border border-border rounded-lg p-4">
            <h2 className="text-sm font-bold mb-3">Order Summary ({cartItems.length} items)</h2>
            <div className="space-y-2 text-xs mb-4 pb-4 border-b border-border">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery</span>
                <span>{formatCurrency(deliveryFee)}</span>
              </div>
            </div>
            <div className="flex justify-between font-bold text-sm">
              <span>Total</span>
              <span>{formatCurrency(cartTotal)}</span>
            </div>
          </div>

          {/* Checkout Form */}
          <form onSubmit={handleCheckout} className="bg-white border border-border rounded-lg p-4 space-y-4">
            <h2 className="text-sm font-bold">Order Details</h2>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Delivery Type Selection */}
            <div className="border border-border rounded-lg p-3 space-y-3">
              <Label className="text-xs font-semibold">Order Location</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-muted">
                  <RadioGroup value={deliveryType} onValueChange={(value) => setDeliveryType(value as 'restaurant' | 'delivery')}>
                    <RadioGroupItem value="restaurant" id="restaurant" />
                  </RadioGroup>
                  <div className="flex items-center gap-2 flex-1">
                    <Home className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="text-xs font-medium">At Restaurant</div>
                      <div className="text-xs text-muted-foreground">No delivery fee</div>
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-muted">
                  <RadioGroup value={deliveryType} onValueChange={(value) => setDeliveryType(value as 'restaurant' | 'delivery')}>
                    <RadioGroupItem value="delivery" id="delivery" />
                  </RadioGroup>
                  <div className="flex items-center gap-2 flex-1">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <div className="text-xs font-medium">Different Address</div>
                      <div className="text-xs text-muted-foreground">₦{formatCurrency(1000).replace('₦', '')}</div>
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Customer Name */}
            <div>
              <Label htmlFor="name" className="text-xs font-semibold">
                Full Name *
              </Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                className="mt-1 h-8 text-xs"
              />
            </div>

            {/* Phone */}
            <div>
              <Label htmlFor="phone" className="text-xs font-semibold">
                Phone Number *
              </Label>
              <Input
                id="phone"
                placeholder="+234 80000000"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="mt-1 h-8 text-xs"
              />
            </div>

            {/* Address - only show if delivery */}
            {deliveryType === 'delivery' && (
              <div>
                <Label htmlFor="address" className="text-xs font-semibold">
                  Delivery Address *
                </Label>
                <Textarea
                  id="address"
                  placeholder="Enter your full delivery address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="mt-1 text-xs min-h-12"
                />
              </div>
            )}

            {/* Special Notes */}
            <div>
              <Label htmlFor="notes" className="text-xs font-semibold">
                Special Instructions (Optional)
              </Label>
              <Textarea
                id="notes"
                placeholder="Any special requests or notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="mt-1 text-xs min-h-12"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-9 bg-primary text-white hover:bg-primary-dark text-sm font-medium flex items-center justify-center gap-2"
            >
              {loading && <Loader className="w-4 h-4 animate-spin" />}
              {loading ? 'Processing...' : `Pay ${formatCurrency(cartTotal)}`}
            </Button>
          </form>

          {/* Info */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-xs text-muted-foreground space-y-2">
            <p>
              <strong>Payment Method:</strong> Your payment will be processed securely using Paystack
            </p>
            <p>
              <strong>Delivery:</strong> {deliveryType === 'restaurant' ? 'You will pick up your order at the restaurant' : 'Your order will be delivered to the provided address'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
