'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  UtensilsCrossed,
  Clock,
  Check,
} from 'lucide-react';
import { calculateServiceFee } from '@/lib/service-fee';
import { isOrderingPaused, type StorefrontHours } from '@/lib/hours-shared';
import {
  OrderingPausedButtonNote,
  OrderingPausedNotice,
} from '@/components/storefront/ordering-paused-notice';
import { AddressSearch, type AddressResult } from '@/components/delivery/address-search';
import { PinMap } from '@/components/delivery/pin-map';
import type { DeliveryQuote, LatLng } from '@/lib/delivery/types';

interface Restaurant {
  id: string;
  name: string;
  email: string;
  phone?: string;
  logo_url?: string;
  /** Batch 3A-fix: opening hours, used to mirror the server's ordering gate. */
  hours?: StorefrontHours | null;
  /** Batch 3B: delivery configuration, additive. */
  delivery?: {
    configured: boolean;
    hasAreas: boolean;
    activeAreaCount: number;
    prepTimeMinutes: number;
    mapboxConfigured: boolean;
  } | null;
  /** Batch 3B: active dine-in labels, additive. Empty when none are configured. */
  tableLabels?: Array<{ id: string; label: string }> | null;
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

const round2 = (value: number) => Math.round((Number(value) || 0) * 100) / 100;

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
  const [hours, setHours] = useState<StorefrontHours | null>(null);
  /** Set when the server itself refused the order with RESTAURANT_CLOSED. */
  const [closedByServer, setClosedByServer] = useState(false);
  const [serverOpensAt, setServerOpensAt] = useState<string | null>(null);

  /* ------------------------- Batch 3B delivery state ------------------------- */
  const [addressPoint, setAddressPoint] = useState<LatLng | null>(null);
  const [quote, setQuote] = useState<DeliveryQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState('');
  /** Table chosen in the storefront (QR link) or here. */
  const [selectedTable, setSelectedTable] = useState('');
  const quoteRequest = useRef(0);

  const tableLabels = useMemo(
    () => (restaurant?.tableLabels ?? []).filter((label) => label?.label),
    [restaurant?.tableLabels],
  );
  const deliveryConfig = restaurant?.delivery ?? null;
  const areasConfigured = Boolean(deliveryConfig?.hasAreas);
  const schemaConfigured = Boolean(deliveryConfig?.configured);

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

    // A table chosen from a QR code on an earlier screen survives to checkout.
    const storedTable = sessionStorage.getItem(`table_${slug}`);
    if (storedTable) setSelectedTable(storedTable);

    const fetchData = async () => {
      try {
        const response = await fetch(`/api/restaurants/${slug}/menu`);
        const data = await response.json();
        setRestaurant(data.business);
        setHours(data.business?.hours ?? null);

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

  const serviceFee = useMemo(
    () => calculateServiceFee(subtotal, serviceFeeConfig),
    [subtotal, serviceFeeConfig]
  );

  /**
   * Ask the server what delivery costs for this point.
   *
   * This is a read: the order API runs the same resolver again and refuses the
   * order if anything moved, so a stale answer here can cost a retry but never
   * a wrong charge.
   */
  const fetchQuote = useCallback(
    async (point: LatLng | null): Promise<DeliveryQuote | null> => {
      if (!restaurant?.id) return null;
      const requestId = ++quoteRequest.current;
      setQuoteLoading(true);
      setQuoteError('');
      try {
        const response = await fetch('/api/delivery/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId: restaurant.id,
            deliveryType: 'delivery',
            subtotal,
            lat: point?.lat ?? null,
            lng: point?.lng ?? null,
          }),
        });
        const data = await response.json();
        if (requestId !== quoteRequest.current) return null;
        if (!response.ok || !data?.quote) {
          setQuoteError(data?.error || 'Could not check delivery for that address.');
          return null;
        }
        setQuote(data.quote);
        return data.quote as DeliveryQuote;
      } catch {
        if (requestId === quoteRequest.current) {
          setQuoteError('Could not check delivery for that address.');
        }
        return null;
      } finally {
        if (requestId === quoteRequest.current) setQuoteLoading(false);
      }
    },
    [restaurant?.id, subtotal],
  );

  // Re-price delivery when the address or the basket changes.
  useEffect(() => {
    if (deliveryType !== 'delivery' || !restaurant?.id) {
      setQuote(null);
      setQuoteError('');
      return;
    }
    if (!addressPoint) {
      setQuote(null);
      return;
    }
    const timer = setTimeout(() => {
      void fetchQuote(addressPoint);
    }, 250);
    return () => clearTimeout(timer);
  }, [deliveryType, addressPoint, restaurant?.id, fetchQuote]);

  const quoteFee =
    deliveryType === 'delivery' && quote?.deliverable ? quote.fee : 0;
  const deliveryFee = deliveryType === 'delivery' ? quoteFee : 0;

  const cartTotal = round2(subtotal + deliveryFee + serviceFee);
  const totalItemCount = cartItems.reduce((n, i) => n + i.quantity, 0);

  // Mirrors the server gate in /api/orders. closedByServer covers the case where
  // the restaurant closed (or turned the setting off) after this page loaded.
  const orderingPaused = closedByServer || isOrderingPaused(hours);
  const opensAt = serverOpensAt ?? hours?.opensAt ?? null;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(Number(amount) || 0);

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());

  const handleAddressSelect = (result: AddressResult) => {
    const point = { lat: result.lat, lng: result.lng };
    setAddressPoint(point);
    setFormData((current) => ({
      ...current,
      address: result.placeName || result.name,
    }));
  };

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (orderingPaused) {
      setError(
        opensAt
          ? `This restaurant is not taking orders right now. ${opensAt}.`
          : 'This restaurant is not taking orders right now.',
      );
      return;
    }

    const missing: string[] = [];
    if (!formData.customerName.trim()) missing.push('Full name');
    if (!formData.email.trim()) missing.push('Email');
    else if (!isValidEmail(formData.email)) missing.push('A valid email');
    if (!formData.phone.trim()) missing.push('Phone number');
    if (deliveryType === 'delivery' && !formData.address.trim()) missing.push('Delivery address');
    if (deliveryType === 'delivery' && areasConfigured && !addressPoint) {
      missing.push('An address chosen from the search results');
    }
    if (deliveryType !== 'delivery' && tableLabels.length > 0 && !selectedTable) {
      missing.push('Your table');
    }
    if (cartItems.length === 0) missing.push('Cart items');
    if (!restaurant?.id) missing.push('Restaurant info');

    if (missing.length > 0) {
      setError(`Please provide: ${missing.join(', ')}`);
      return;
    }

    setLoading(true);

    try {
      // Re-quote immediately before creating the order, so the total the server
      // compares against is the total it will charge.
      let feeForThisOrder = 0;
      if (deliveryType === 'delivery') {
        const fresh = await fetchQuote(addressPoint);
        if (!fresh) {
          setError(
            quoteError ||
              'We could not confirm delivery for that address. Check it and try again.',
          );
          return;
        }
        if (!fresh.deliverable) {
          setError(fresh.message);
          return;
        }
        if (fresh.belowMinimum) {
          setError(
            `Add ${formatCurrency(fresh.remainingForMinimum ?? 0)} more to order from ${
              fresh.areaName ? `the ${fresh.areaName} area` : 'this delivery area'
            }.`,
          );
          return;
        }
        feeForThisOrder = fresh.fee;
      }

      const totalForOrder = round2(subtotal + serviceFee + feeForThisOrder);

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
          // Batch 3B: coordinates and table are advisory here and verified
          // server-side; the fee sent below is only compared, never charged.
          deliveryLat: deliveryType === 'delivery' ? addressPoint?.lat ?? null : null,
          deliveryLng: deliveryType === 'delivery' ? addressPoint?.lng ?? null : null,
          deliveryAddressText:
            deliveryType === 'delivery' ? formData.address.trim() : null,
          tableLabel: deliveryType === 'delivery' ? null : selectedTable || null,
          items: cartItems.map((item) => {
            const basePrice = Number(item.price) || 0;
            return {
              menu_item_id: item.id,
              quantity: item.quantity,
              // item_price is the BASE per-unit price only.
              // Add-ons live in `configuration` and are summed at render time.
              item_price: basePrice,
              configuration: item.addons || null,
            };
          }),
          subtotal,
          deliveryFee: feeForThisOrder,
          serviceFee,
          serviceFeeType: 'tiered',
          total: totalForOrder,
        }),
      });

      const orderData = await orderResponse.json();

      // The server re-prices every order from the database. If its total differs
      // from what this page calculated, it refuses to create the order (409).
      // Show its message and stay on this page instead of going to payment.
      if (orderData?.code === 'PRICE_MISMATCH') {
        setError(orderData.error || 'Prices have changed. Please review your cart.');
        if (deliveryType === 'delivery') void fetchQuote(addressPoint);
        return;
      }

      // Batch 3B refusals: the address moved out of area, the table was
      // disabled, or the basket fell under the area minimum.
      if (
        orderData?.code === 'OUTSIDE_AREA' ||
        orderData?.code === 'COORDS_REQUIRED' ||
        orderData?.code === 'BELOW_MINIMUM' ||
        orderData?.code === 'INVALID_TABLE' ||
        orderData?.code === 'TABLE_REQUIRED'
      ) {
        setError(orderData.error || 'This order could not be placed. Please check the details.');
        if (orderData?.code === 'OUTSIDE_AREA' || orderData?.code === 'COORDS_REQUIRED') {
          void fetchQuote(addressPoint);
        }
        return;
      }

      // The restaurant stopped taking orders between page load and this click.
      // Show the same message the notice uses and keep the button disabled.
      if (orderData?.code === 'RESTAURANT_CLOSED') {
        const nextOpening: string | null =
          typeof orderData.opensAt === 'string' ? orderData.opensAt : null;
        setClosedByServer(true);
        setServerOpensAt(nextOpening);
        setError(
          `${orderData.error || 'This restaurant is not taking orders right now.'}${
            nextOpening ? ` ${nextOpening}.` : ''
          }`,
        );
        return;
      }

      if (!orderResponse.ok) {
        setError(orderData.error || 'Failed to create order');
        return;
      }

      // The table has been used for this order; the next customer starts fresh.
      if (deliveryType !== 'delivery' && selectedTable) {
        sessionStorage.removeItem(`table_${slug}`);
      }

      // Initialize Paystack with the CUSTOMER email
      const paymentResponse = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: orderData.orderId,
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

  const deliverySummary = buildDeliverySummary({
    deliveryType,
    areasConfigured,
    schemaConfigured,
    quote,
    quoteLoading,
    formatCurrency,
  });

  return (
    <div
      className={`min-h-screen bg-background lg:pb-12 ${
        orderingPaused ? 'pb-40' : 'pb-32'
      }`}
    >
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

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {/* Once the server has refused an attempt, the same message sits in the
            error state beside the button; showing it twice would read as noise. */}
        {orderingPaused && !closedByServer && (
          <OrderingPausedNotice restaurantName={restaurant?.name} opensAt={opensAt} />
        )}

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
                  subtitle="Dine-in or pick up · No delivery fee"
                  onClick={() => setDeliveryType('restaurant')}
                />
                <DeliveryOption
                  active={deliveryType === 'delivery'}
                  icon={<MapPin className="w-4 h-4" />}
                  title="Delivery"
                  subtitle={deliveryOptionSubtitle({
                    areasConfigured,
                    schemaConfigured,
                    quote,
                    formatCurrency,
                  })}
                  onClick={() => setDeliveryType('delivery')}
                />
              </div>

              {deliveryType === 'delivery' && (
                <div className="space-y-3 rounded-xl bg-muted/30 p-3">
                  {areasConfigured && deliveryConfig?.mapboxConfigured && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">
                        Find your address
                      </Label>
                      <AddressSearch
                        onSelect={handleAddressSelect}
                        proximity={null}
                        placeholder="Street, estate or landmark in Nigeria"
                      />
                      <p className="text-[11px] text-muted-foreground">
                        We check the address against {deliveryConfig.activeAreaCount}{' '}
                        {deliveryConfig.activeAreaCount === 1 ? 'delivery area' : 'delivery areas'} before
                        you pay.
                      </p>
                    </div>
                  )}

                  {areasConfigured && addressPoint && (
                    <PinMap center={addressPoint} onChange={(point) => setAddressPoint(point)} height={190} />
                  )}

                  {areasConfigured && (
                    <DeliveryQuotePanel
                      quote={quote}
                      loading={quoteLoading}
                      error={quoteError}
                      hasPoint={Boolean(addressPoint)}
                      formatCurrency={formatCurrency}
                    />
                  )}
                </div>
              )}

              {/* Dine-in table, only when the restaurant has labels. */}
              {deliveryType !== 'delivery' && tableLabels.length > 0 && (
                <div className="space-y-2 rounded-xl bg-muted/30 p-3">
                  <div className="flex items-center gap-1.5">
                    <UtensilsCrossed className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
                    <Label className="text-xs font-semibold">
                      Your table <span className="text-destructive">*</span>
                    </Label>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Your order goes straight to the right table. Ask a member of staff if you are not
                    sure which one is yours.
                  </p>
                  <div
                    role="group"
                    aria-label="Choose your table"
                    className="grid grid-cols-3 gap-1.5 sm:grid-cols-4"
                  >
                    {tableLabels.map((table) => {
                      const active = selectedTable === table.label;
                      return (
                        <button
                          key={table.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            setSelectedTable(table.label);
                            sessionStorage.setItem(`table_${slug}`, table.label);
                          }}
                          className={`flex h-11 min-w-0 items-center justify-center gap-1 rounded-lg border px-2 text-xs font-semibold transition-colors ${
                            active
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-border bg-card text-foreground hover:bg-muted'
                          }`}
                        >
                          {active && <Check className="h-3 w-3 flex-shrink-0" aria-hidden="true" />}
                          <span className="truncate">{table.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
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
                    onChange={(e) => {
                      setFormData({ ...formData, address: e.target.value });
                      // The typed line is the address the rider reads; the pin
                      // is what decides the fee. Editing the text does not move
                      // the pin, so the two cannot silently disagree.
                    }}
                    className="text-sm min-h-20"
                  />
                  {areasConfigured && addressPoint && (
                    <p className="text-[11px] text-muted-foreground">
                      Pin set at {addressPoint.lat.toFixed(5)}, {addressPoint.lng.toFixed(5)}.
                      {formData.address.trim() &&
                        ' Edit the text above if the rider needs a landmark, or move the pin on the map.'}
                    </p>
                  )}
                  {areasConfigured && !formData.address.trim() && (
                    <p className="text-[11px] text-muted-foreground">
                      Search above and pick the exact address, then adjust the pin.
                    </p>
                  )}
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
            <div className="hidden lg:block space-y-2">
              <Button
                type="submit"
                disabled={loading || orderingPaused}
                className="w-full h-12 font-semibold flex items-center justify-center gap-2"
              >
                {loading && <Loader className="w-4 h-4 animate-spin" />}
                {loading
                  ? 'Processing...'
                  : orderingPaused
                    ? 'Ordering paused'
                    : `Pay ${formatCurrency(cartTotal)}`}
              </Button>
              {orderingPaused && <OrderingPausedButtonNote opensAt={opensAt} />}
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
              deliveryNote={deliverySummary.note}
              deliveryFeeIsEstimate={deliverySummary.pending}
              tableLabel={deliveryType !== 'delivery' ? selectedTable : ''}
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
              deliveryNote={deliverySummary.note}
              deliveryFeeIsEstimate={deliverySummary.pending}
              tableLabel={deliveryType !== 'delivery' ? selectedTable : ''}
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
        <div className="max-w-6xl mx-auto p-3 space-y-1.5">
          {orderingPaused && (
            <OrderingPausedButtonNote opensAt={opensAt} className="text-left" />
          )}
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground leading-none">Total</p>
              <p className="text-base font-bold text-primary tabular-nums leading-tight">
                {formatCurrency(cartTotal)}
              </p>
            </div>
            <Button
              onClick={handleCheckout as any}
              disabled={loading || orderingPaused}
              className="h-11 px-5 font-semibold flex items-center gap-2"
            >
              {loading && <Loader className="w-4 h-4 animate-spin" />}
              {loading ? 'Processing...' : orderingPaused ? 'Paused' : 'Pay Now'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------- delivery copy ------------------------------- */

/** The one-line promise under the Delivery option. */
function deliveryOptionSubtitle({
  areasConfigured,
  schemaConfigured,
  quote,
  formatCurrency,
}: {
  areasConfigured: boolean;
  schemaConfigured: boolean;
  quote: DeliveryQuote | null;
  formatCurrency: (n: number) => string;
}) {
  if (areasConfigured) {
    if (quote?.deliverable) {
      if (quote.belowMinimum) return 'Add more to reach the minimum order';
      return quote.fee > 0 ? `To your address · ${formatCurrency(quote.fee)}` : 'To your address · Free';
    }
    return 'Set by your address';
  }
  // No areas: delivery exists and costs nothing. Before the schema is migrated
  // the server still charges the old flat fee, so do not promise "free".
  if (!schemaConfigured) return 'Different address';
  return 'Different address · No delivery fee';
}

/** A short note for the summary line, so the fee is never unexplained. */
function buildDeliverySummary({
  deliveryType,
  areasConfigured,
  schemaConfigured,
  quote,
  quoteLoading,
  formatCurrency,
}: {
  deliveryType: 'restaurant' | 'delivery';
  areasConfigured: boolean;
  schemaConfigured: boolean;
  quote: DeliveryQuote | null;
  quoteLoading: boolean;
  formatCurrency: (n: number) => string;
}): { note: string; pending: boolean } {
  if (deliveryType !== 'delivery') return { note: 'Dine-in or pick up', pending: false };
  if (!areasConfigured) {
    return {
      note: schemaConfigured ? 'No delivery fee set by this restaurant' : 'Charged at the restaurant rate',
      pending: false,
    };
  }
  if (quoteLoading && !quote) return { note: 'Checking your address', pending: true };
  if (!quote) return { note: 'Choose your address', pending: false };
  if (!quote.deliverable) return { note: 'This restaurant does not deliver there', pending: false };
  if (quote.belowMinimum) return { note: `Minimum order ${formatCurrency(quote.minOrder ?? 0)}`, pending: false };
  if (quote.estimatedMinutes) {
    return {
      note: `${quote.areaName ?? 'Delivery area'} · ${quote.estimatedMinutes.min}–${quote.estimatedMinutes.max} min`,
      pending: false,
    };
  }
  return { note: quote.areaName ?? 'Delivery area', pending: false };
}

/* ------------------------------- subcomponents ------------------------------- */

function DeliveryQuotePanel({
  quote,
  loading,
  error,
  hasPoint,
  formatCurrency,
}: {
  quote: DeliveryQuote | null;
  loading: boolean;
  error: string;
  hasPoint: boolean;
  formatCurrency: (n: number) => string;
}) {
  if (error) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-[11px] text-destructive">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <span>{error}</span>
      </div>
    );
  }

  if (!hasPoint) {
    return (
      <p className="flex items-start gap-2 text-[11px] text-muted-foreground">
        <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <span>Search your address to see the delivery fee and time before you pay.</span>
      </p>
    );
  }

  if (loading) {
    return (
      <div className="space-y-1.5" aria-live="polite">
        <div className="h-3 w-40 animate-pulse rounded bg-muted" />
        <div className="h-3 w-28 animate-pulse rounded bg-muted" />
        <p className="sr-only">Checking delivery for this address</p>
      </div>
    );
  }

  if (!quote) return null;

  if (!quote.deliverable) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-[11px] text-destructive">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="font-semibold">This restaurant does not deliver to that address.</p>
          <p className="mt-0.5">Move the pin closer, try a nearby landmark, or choose At Restaurant.</p>
        </div>
      </div>
    );
  }

  if (quote.belowMinimum) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-50 p-2.5 text-[11px] text-amber-900">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="font-semibold">
            Add {formatCurrency(quote.remainingForMinimum ?? 0)} more to order
            {quote.areaName ? ` from ${quote.areaName}` : ''}.
          </p>
          <p className="mt-0.5">
            Minimum order here is {formatCurrency(quote.minOrder ?? 0)}.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-card p-2.5 text-[11px]" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <span className="font-semibold text-foreground">
          {quote.areaName ?? (quote.legacy ? 'Delivery' : 'Your address')}
        </span>
        <span className="tabular-nums font-semibold text-foreground">
          {quote.fee > 0 ? formatCurrency(quote.fee) : 'Free delivery'}
        </span>
      </div>

      {quote.feeWaived && (
        <p className="text-emerald-700">
          Free delivery applied on a {formatCurrency(quote.baseFee)} fee.
        </p>
      )}

      {quote.estimatedMinutes && (
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="w-3 h-3" aria-hidden="true" />
          Arrives in about {quote.estimatedMinutes.min}–{quote.estimatedMinutes.max} minutes
        </p>
      )}

      {quote.remainingForFreeDelivery != null && quote.remainingForFreeDelivery > 0 && (
        <p className="text-muted-foreground">
          Add {formatCurrency(quote.remainingForFreeDelivery)} more for free delivery.
        </p>
      )}

      {quote.freeDeliveryThreshold != null && quote.fee === 0 && (
        <p className="text-emerald-700">
          Free delivery on orders from {formatCurrency(quote.freeDeliveryThreshold)}.
        </p>
      )}
    </div>
  );
}

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
  deliveryNote,
  deliveryFeeIsEstimate,
  tableLabel,
  total,
  formatCurrency,
}: {
  cartItems: CartItem[];
  totalItemCount: number;
  subtotal: number;
  serviceFee: number;
  deliveryFee: number;
  deliveryNote?: string;
  deliveryFeeIsEstimate?: boolean;
  tableLabel?: string;
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

      {tableLabel && (
        <div className="flex items-center justify-between rounded-lg bg-muted/60 px-2.5 py-1.5 text-[11px]">
          <span className="text-muted-foreground">Table</span>
          <span className="font-semibold">{tableLabel}</span>
        </div>
      )}

      <div className="pt-3 border-t border-border space-y-2 text-sm">
        <Row label="Subtotal" value={formatCurrency(subtotal)} muted formatted />
        <Row label="Service Fee" value={`+${formatCurrency(serviceFee)}`} muted formatted />
        <Row
          label="Delivery"
          value={
            deliveryFeeIsEstimate
              ? '—'
              : deliveryFee > 0
                ? `+${formatCurrency(deliveryFee)}`
                : 'Free'
          }
          muted
          formatted
        />
        {deliveryNote && (
          <p className="text-[10.5px] text-muted-foreground -mt-1">{deliveryNote}</p>
        )}
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
