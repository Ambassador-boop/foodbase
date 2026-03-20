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
        console.log('[v0] Checkout: Fetching restaurant for slug:', slug);
        console.log('[v0] Checkout: Cart items loaded:', cartItems, 'Total items:', cartItems.length);
        const response = await fetch(`/api/restaurants/${slug}/menu`);
        const data = await response.json();
        console.log('[v0] Checkout: Restaurant data received:', data.business);
        setRestaurant(data.business);
      } catch (err) {
        console.error('[v0] Checkout: Error fetching restaurant:', err);
      } finally {
        setLoadingPage(false);
      }
    };

    fetchRestaurant();
  }, [slug]);

  // Calculate totals
  const subtotal = cartItems.reduce((total, item) => {
    const itemPrice = Number(item.price) || 0;
    const addonsPrice = item.addons?.reduce((sum: number, addon: any) => sum + (Number(addon.price) || 0), 0) || 0;
    return total + (itemPrice + addonsPrice) * item.quantity;
  }, 0);

  const deliveryFee = deliveryType === 'delivery' ? 1000 : 0;
  const serviceFee = Math.round(subtotal * 0.075 * 100) / 100; // 7.5% service fee with proper rounding
  const cartTotal = Math.round((subtotal + deliveryFee + serviceFee) * 100) / 100;

  console.log('[v0] Checkout calculations:', {
    cartItemsCount: cartItems.length,
    subtotal,
    deliveryFee,
    serviceFee,
    cartTotal,
  });

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate form - check all required fields
    const missingFields: string[] = [];
    if (!formData.customerName.trim()) missingFields.push('Name');
    if (!formData.phone.trim()) missingFields.push('Phone');
    if (deliveryType === 'delivery' && !formData.address.trim()) missingFields.push('Delivery Address');
    if (cartItems.length === 0) missingFields.push('Cart');
    if (!restaurant) missingFields.push('Restaurant info');
    if (!restaurant?.email) missingFields.push('Business email');

    if (missingFields.length > 0) {
      console.log('[v0] Missing fields:', missingFields);
      setError(`Missing Fields required: ${missingFields.join(', ')}`);
      return;
    }

    setLoading(true);

    try {
      console.log('[v0] Checkout: Starting payment process');
      console.log('[v0] Checkout: Restaurant email:', restaurant.email);
      console.log('[v0] Checkout: Subtotal:', subtotal, 'Service Fee:', serviceFee, 'Delivery:', deliveryFee, 'Total:', cartTotal);

      // Create order - customer email is required
      if (!restaurant?.id) {
        setError('Restaurant information missing');
        setLoading(false);
        return;
      }

      const orderResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: restaurant.id,
          customerName: formData.customerName,
          email: restaurant.email, // Use business email for orders
          phone: formData.phone,
          address: deliveryType === 'delivery' ? formData.address : 'At Restaurant',
          deliveryType,
          notes: formData.notes,
          items: cartItems.map(item => ({
            menu_item_id: item.id, // menu item ID
            quantity: item.quantity,
            // item_price is total for this order line: (base price + addons) * quantity
            item_price: item.price,
            configuration: item.addons || null, // store addons as configuration
          })),
          subtotal,
          deliveryFee,
          serviceFee,
          total: cartTotal,
        }),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        console.log('[v0] Order creation failed:', orderData.error);
        setError(orderData.error || 'Failed to create order');
        return;
      }

      console.log('[v0] Order created:', orderData.orderId);

      // Initialize payment with business owner's email
      console.log('[v0] Initializing payment with email:', restaurant.email);
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
        console.log('[v0] Payment initialization failed:', paymentData.error);
        setError(paymentData.error || 'Failed to initialize payment');
        return;
      }

      console.log('[v0] Payment initialized, redirecting to Paystack');

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
                <span>Service Fee (7.5%)</span>
                <span>{formatCurrency(serviceFee)}</span>
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
