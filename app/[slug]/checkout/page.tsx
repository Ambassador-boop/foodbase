'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  ArrowLeft,
  Loader,
  MapPin,
  Home,
  ShieldCheck,
  Mail,
  Phone,
  User,
  StickyNote,
  ImageIcon,
} from 'lucide-react';
import { calculateServiceFee } from '@/lib/service-fee';

interface Restaurant {
  id: string;
  name: string;
  email: string;
  phone?: string;
  logo_url?: string;
}

interface ServiceFeeConfig {
  id: string;
  tier_value: number;
  service_fee: number;
}

interface CartItem {
  id: string;
  type: 'menu' | 'drink';
  name: string;
  price: number;
  image_url?: string;
  quantity: number;
  addons?: { id: string; name: string; price: number; image_url?: string }[];
}

const DELIVERY_FEE = 1000;

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [deliveryType, setDeliveryType] = useState<'restaurant' | 'delivery'>('restaurant');
  const [formData, setFormData] = useState({
    customerName: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
  });
  const [serviceFeeConfig, setServiceFeeConfig] = useState<ServiceFeeConfig[]>([]);

  const [loadingPage, setLoadingPage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const storedCart = sessionStorage.getItem(`cart_${slug}`);
    if (storedCart) {
      try {
        const cartData = JSON.parse(storedCart);
        setCartItems(Array.isArray(cartData) ? cartData : []);
      } catch {
        setCartItems([]);
      }
    }

    const fetchData = async () => {
      try {
        const response = await fetch(`/api/restaurants/${slug}/menu`);
        const data = await response.json();
        setRestaurant(data.business);

        const configResponse = await fetch('/api/admin/service-fee');
        const configData = await configResponse.json();
        setServiceFeeConfig(Array.isArray(configData) ? configData : []);
      } catch (err) {
        console.error('[v0] Checkout: Error fetching data:', err);
      } finally {
        setLoadingPage(false);
      }
    };

    fetchData();
  }, [slug]);

  const subtotal = useMemo(
    () =>
      cartItems.reduce((total, item) => {
        const itemPrice = Number(item.price) || 0;
        const addonsPrice =
          item.addons?.reduce((sum, addon) => sum + (Number(addon.price) || 0), 0) || 0;
        return total + (itemPrice + addonsPrice) * item.quantity;
      }, 0),
    [cartItems]
  );

  const deliveryFee = deliveryType === 'delivery' ? DELIVERY_FEE : 0;
  const serviceFee = useMemo(
    () => calculateServiceFee(subtotal, serviceFeeConfig),
    [subtotal, serviceFeeConfig]
  );
  const cartTotal = Math.round((subtotal + deliveryFee + serviceFee) * 100) / 100;
  const totalItemCount = cartItems.reduce((n, i) => n + i.quantity, 0);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const missing: string[] = [];
    if (!formData.customerName.trim()) missing.push('Full name');
    if (!formData.email.trim()) missing.push('Email');
    else if (!isValidEmail(formData.email)) missing.push('A valid email');
    if (!formData.phone.trim()) missing.push('Phone number');
    if (deliveryType === 'delivery' && !formData.address.trim()) missing.push('Delivery address');
    if (cartItems.length === 0) missing.push('Cart items');
    if (!restaurant?.id) missing.push('Restaurant info');

    if (missing.length > 0) {
      setError(`Please provide: ${missing.join(', ')}`);
      return;
    }

    setLoading(true);

    try {
      const orderResponse = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId: restaurant!.id,
          customerName: formData.customerName.trim(),
          email: formData.email.trim(), // CUSTOMER email (not business email)
          phone: formData.phone.trim(),
          address:
            deliveryType === 'delivery' ? formData.address.trim() : 'At Restaurant',
          deliveryType,
          notes: formData.notes.trim(),
          items: cartItems.map((item) => {
            const basePrice = Number(item.price) || 0;
            const addonsPrice =
              item.addons?.reduce((sum, a) => sum + (Number(a.price) || 0), 0) || 0;
            return {
              menu_item_id: item.id,
              quantity: item.quantity,
              item_price: basePrice + addonsPrice, // unit price including add-ons
              configuration: item.addons || null,
            };
          }),
          subtotal,
          deliveryFee,
          serviceFee,
          serviceFeeType: 'tiered',
          total: cartTotal,
        }),
      });

      const orderData = await orderResponse.json();
      if (!orderResponse.ok) {
        setError(orderData.error || 'Failed to create order');
        return;
      }

      // Initialize Paystack with the CUSTOMER email
      const paymentResponse = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: cartTotal,
          orderId: orderData.orderId,
          email: formData.email.trim(),
          reference: orderData.reference,
        }),
      });

      const paymentData = await paymentResponse.json();
      if (!paymentResponse.ok) {
        setError(paymentData.error || 'Failed to initialize payment');
        return;
      }

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
        <p className="text-muted-foreground text-sm">Loading checkout...</p>
      </div>
    );
  }

  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-card border-b border-border sticky top-0 z-40">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
            <Link href={`/${slug}`} className="p-2 rounded-full hover:bg-muted">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-base font-bold">Checkout</h1>
          </div>
        </header>
        <div className="max-w-2xl mx-auto px-4 py-12 text-center">
          <p className="text-muted-foreground mb-4">Your cart is empty</p>
          <Link href={`/${slug}`}>
            <Button>Continue Shopping</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32 lg:pb-12">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href={`/${slug}/cart`}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Back to cart"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold leading-tight">Checkout</h1>
            <p className="text-xs text-muted-foreground truncate">
              {restaurant?.name}
            </p>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
          {/* Form */}
          <form onSubmit={handleCheckout} className="space-y-5">
            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Order location */}
            <section className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-3">
              <h2 className="text-sm font-bold">Order Location</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <DeliveryOption
                  active={deliveryType === 'restaurant'}
                  icon={<Home className="w-4 h-4" />}
                  title="At Restaurant"
                  subtitle="Pick up · No delivery fee"
                  onClick={() => setDeliveryType('restaurant')}
                />
                <DeliveryOption
                  active={deliveryType === 'delivery'}
                  icon={<MapPin className="w-4 h-4" />}
                  title="Delivery"
                  subtitle={`Different address · ${formatCurrency(DELIVERY_FEE)}`}
                  onClick={() => setDeliveryType('delivery')}
                />
              </div>
            </section>

            {/* Contact details */}
            <section className="bg-card border border-border rounded-2xl p-4 sm:p-5 space-y-4">
              <h2 className="text-sm font-bold">Your Details</h2>

              <FieldWithIcon
                id="name"
                icon={<User className="w-4 h-4" />}
                label="Full Name"
                required
              >
                <Input
                  id="name"
                  placeholder="Jane Doe"
                  value={formData.customerName}
                  onChange={(e) =>
                    setFormData({ ...formData, customerName: e.target.value })
                  }
                  className="h-10 pl-9"
                />
              </FieldWithIcon>

              <FieldWithIcon
                id="email"
                icon={<Mail className="w-4 h-4" />}
                label="Email Address"
                required
                hint="Your receipt and payment confirmation will be sent here."
              >
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="h-10 pl-9"
                />
              </FieldWithIcon>

              <FieldWithIcon
                id="phone"
                icon={<Phone className="w-4 h-4" />}
                label="Phone Number"
                required
              >
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+234 800 000 0000"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="h-10 pl-9"
                />
              </FieldWithIcon>

              {deliveryType === 'delivery' && (
                <div className="space-y-1.5">
                  <Label htmlFor="address" className="text-xs font-semibold">
                    Delivery Address <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="address"
                    placeholder="Street, area, landmark, city"
                    value={formData.address}
                    onChange={(e) =>
                      setFormData({ ...formData, address: e.target.value })
                    }
                    className="text-sm min-h-20"
                  />
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs font-semibold flex items-center gap-1.5">
                  <StickyNote className="w-3.5 h-3.5" />
                  Special Instructions <span className="text-muted-foreground font-normal">(Optional)</span>
                </Label>
                <Textarea
                  id="notes"
                  placeholder="Allergies, preferences, gate code..."
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData({ ...formData, notes: e.target.value })
                  }
                  className="text-sm min-h-16"
                />
              </div>
            </section>

            {/* Submit (desktop) */}
            <div className="hidden lg:block">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-12 font-semibold flex items-center justify-center gap-2"
              >
                {loading && <Loader className="w-4 h-4 animate-spin" />}
                {loading ? 'Processing...' : `Pay ${formatCurrency(cartTotal)}`}
              </Button>
            </div>
          </form>

          {/* Order summary (desktop) */}
          <aside className="hidden lg:block">
            <SummaryCard
              cartItems={cartItems}
              totalItemCount={totalItemCount}
              subtotal={subtotal}
              serviceFee={serviceFee}
              deliveryFee={deliveryFee}
              total={cartTotal}
              formatCurrency={formatCurrency}
            />
          </aside>

          {/* Order summary (mobile) — appears below form on mobile */}
          <aside className="lg:hidden">
            <SummaryCard
              cartItems={cartItems}
              totalItemCount={totalItemCount}
              subtotal={subtotal}
              serviceFee={serviceFee}
              deliveryFee={deliveryFee}
              total={cartTotal}
              formatCurrency={formatCurrency}
            />
          </aside>
        </div>

        {/* Paystack secured badge — small, bottom of the page */}
        <div className="pt-6 pb-2 flex justify-center">
          <Image
            src="/paystack-secured.png"
            alt="Secured by Paystack — accepts Mastercard, VISA, Verve, and bank transfers"
            width={290}
            height={88}
            className="h-10 sm:h-11 w-auto opacity-90"
            priority={false}
          />
        </div>
      </div>

      {/* Sticky bottom CTA (mobile) */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="max-w-6xl mx-auto p-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-muted-foreground leading-none">Total</p>
            <p className="text-base font-bold text-primary tabular-nums leading-tight">
              {formatCurrency(cartTotal)}
            </p>
          </div>
          <Button
            onClick={handleCheckout as any}
            disabled={loading}
            className="h-11 px-5 font-semibold flex items-center gap-2"
          >
            {loading && <Loader className="w-4 h-4 animate-spin" />}
            {loading ? 'Processing...' : 'Pay Now'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- subcomponents ------------------------------- */

function DeliveryOption({
  active,
  icon,
  title,
  subtitle,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-left p-3 rounded-xl border transition-colors flex items-start gap-3 ${
        active
          ? 'border-primary bg-primary/5 ring-1 ring-primary'
          : 'border-border hover:bg-muted'
      }`}
      aria-pressed={active}
    >
      <span
        className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground mt-0.5">{subtitle}</span>
      </span>
    </button>
  );
}

function FieldWithIcon({
  id,
  icon,
  label,
  required,
  hint,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold">
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
          {icon}
        </span>
        {children}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SummaryCard({
  cartItems,
  totalItemCount,
  subtotal,
  serviceFee,
  deliveryFee,
  total,
  formatCurrency,
}: {
  cartItems: CartItem[];
  totalItemCount: number;
  subtotal: number;
  serviceFee: number;
  deliveryFee: number;
  total: number;
  formatCurrency: (n: number) => string;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 lg:sticky lg:top-20 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-bold text-sm">Order Summary</h2>
        <span className="text-xs text-muted-foreground">
          {totalItemCount} item{totalItemCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Itemised list */}
      <ul className="space-y-2.5 max-h-60 overflow-y-auto pr-1 -mr-1">
        {cartItems.map((item, idx) => {
          const itemPrice = Number(item.price) || 0;
          const addonsPrice =
            item.addons?.reduce((sum, a) => sum + (Number(a.price) || 0), 0) || 0;
          const lineTotal = (itemPrice + addonsPrice) * item.quantity;
          return (
            <li key={`${item.id}-${idx}`} className="flex items-center gap-2.5">
              <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                {item.image_url ? (
                  <Image src={item.image_url} alt={item.name} fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="w-4 h-4" />
                  </div>
                )}
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {item.quantity}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{item.name}</p>
                {item.addons && item.addons.length > 0 && (
                  <p className="text-[11px] text-muted-foreground truncate">
                    + {item.addons.length} add-on{item.addons.length > 1 ? 's' : ''}
                  </p>
                )}
              </div>
              <p className="text-xs font-semibold tabular-nums">{formatCurrency(lineTotal)}</p>
            </li>
          );
        })}
      </ul>

      <div className="pt-3 border-t border-border space-y-2 text-sm">
        <Row label="Subtotal" value={formatCurrency(subtotal)} muted formatted />
        <Row label="Service Fee" value={`+${formatCurrency(serviceFee)}`} muted formatted />
        <Row
          label="Delivery"
          value={deliveryFee > 0 ? `+${formatCurrency(deliveryFee)}` : 'Free'}
          muted
          formatted
        />
      </div>

      <div className="pt-3 border-t border-border flex items-center justify-between">
        <span className="font-bold">Total</span>
        <span className="font-bold text-primary text-lg tabular-nums">
          {formatCurrency(total)}
        </span>
      </div>

      <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Secured by Paystack · 256-bit encrypted</span>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  muted,
  formatted,
}: {
  label: string;
  value: string;
  muted?: boolean;
  formatted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? 'text-muted-foreground' : ''}>{label}</span>
      <span className={`${formatted ? 'tabular-nums' : ''} font-medium`}>{value}</span>
    </div>
  );
}
