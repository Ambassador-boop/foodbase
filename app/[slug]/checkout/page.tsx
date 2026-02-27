'use client';

import { useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, ArrowLeft, Loader } from 'lucide-react';

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;

  const [formData, setFormData] = useState({
    customerName: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Placeholder cart total (would be passed from previous page in real app)
  const cartTotal = 5000;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Create order first
      const orderResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessSlug: slug,
          customerName: formData.customerName,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          notes: formData.notes,
          items: [], // Would be passed from cart
          total: cartTotal,
        }),
      });

      const orderData = await orderResponse.json();

      if (!orderResponse.ok) {
        setError(orderData.error || 'Failed to create order');
        return;
      }

      // Initialize payment
      const paymentResponse = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: cartTotal,
          orderId: orderData.orderId,
        }),
      });

      const paymentData = await paymentResponse.json();

      if (!paymentResponse.ok) {
        setError('Failed to initialize payment');
        return;
      }

      // Redirect to Paystack
      window.location.href = paymentData.authorizationUrl;
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/${slug}`} className="p-1 hover:bg-muted rounded">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold">Checkout</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Order Summary */}
          <div className="bg-white border border-border rounded-lg p-4">
            <h2 className="text-sm font-bold mb-3">Order Summary</h2>
            <div className="space-y-2 text-xs mb-4 pb-4 border-b border-border">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(cartTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery</span>
                <span>{formatCurrency(0)}</span>
              </div>
            </div>
            <div className="flex justify-between font-bold text-sm">
              <span>Total</span>
              <span>{formatCurrency(cartTotal)}</span>
            </div>
          </div>

          {/* Checkout Form */}
          <form onSubmit={handleCheckout} className="bg-white border border-border rounded-lg p-4 space-y-4">
            <h2 className="text-sm font-bold">Delivery Details</h2>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <Label htmlFor="name" className="text-xs font-semibold">
                Full Name
              </Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={formData.customerName}
                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                required
                className="mt-1 h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="email" className="text-xs font-semibold">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  className="mt-1 h-8 text-xs"
                />
              </div>
              <div>
                <Label htmlFor="phone" className="text-xs font-semibold">
                  Phone
                </Label>
                <Input
                  id="phone"
                  placeholder="+234 80000000"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                  className="mt-1 h-8 text-xs"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="address" className="text-xs font-semibold">
                Delivery Address
              </Label>
              <Textarea
                id="address"
                placeholder="Enter your full delivery address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
                className="mt-1 text-xs min-h-12"
              />
            </div>

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
              <strong>Delivery:</strong> Your order will be delivered to the provided address
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
