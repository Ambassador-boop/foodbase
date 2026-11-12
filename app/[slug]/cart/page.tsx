'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  AlertCircle,
  ShoppingBag,
  ImageIcon,
  ShieldCheck,
} from 'lucide-react';
import { calculateServiceFee } from '@/lib/service-fee';
import { isOrderingPaused, type StorefrontHours } from '@/lib/hours-shared';
import {
  OrderingPausedButtonNote,
  OrderingPausedNotice,
} from '@/components/storefront/ordering-paused-notice';

interface CartItem {
  id: string;
  cartKey?: string;
  type: 'menu' | 'drink';
  name: string;
  price: number;
  image_url?: string;
  quantity: number;
  addons?: { id: string; name: string; price: number; image_url?: string }[];
}

interface Restaurant {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
  /** Batch 3A-fix: opening hours, used to mirror the server's ordering gate. */
  hours?: StorefrontHours | null;
}

interface ServiceFeeConfig {
  id: string;
  tier_value: number;
  service_fee: number;
}

export default function CartPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [serviceFeeConfig, setServiceFeeConfig] = useState<ServiceFeeConfig[]>([]);
  const [hours, setHours] = useState<StorefrontHours | null>(null);

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
    fetchRestaurantData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    sessionStorage.setItem(`cart_${slug}`, JSON.stringify(cartItems));
  }, [cartItems, slug]);

  const fetchRestaurantData = async () => {
    try {
      const response = await fetch(`/api/restaurants/${slug}/menu`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch menu');
      setRestaurant(data.business);
      setHours(data.business?.hours ?? null);

      const configResponse = await fetch('/api/admin/service-fee');
      const configData = await configResponse.json();
      setServiceFeeConfig(Array.isArray(configData) ? configData : []);
    } catch (err) {
      console.error('[v0] Cart: Error loading data:', err);
      setError('Restaurant not found or error loading cart');
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(index);
    } else {
      const next = [...cartItems];
      next[index].quantity = quantity;
      setCartItems(next);
    }
  };

  const removeFromCart = (index: number) => {
    setCartItems((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const getAddonQuantity = (addons: CartItem['addons'], addonId: string): number => {
    if (!addons) return 0;
    return addons.filter((a) => a.id === addonId).length;
  };

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
  const cartTotal = Math.round((subtotal + serviceFee) * 100) / 100;
  const totalItemCount = cartItems.reduce((n, i) => n + i.quantity, 0);

  // Mirrors the server gate in /api/orders: paused only when the restaurant
  // turned off orders outside its hours and is closed right now. Editing the
  // cart stays available either way.
  const orderingPaused = isOrderingPaused(hours);
  const opensAt = hours?.opensAt ?? null;

  const formatCurrency = (amount: number) => {
    const num = Number(amount) || 0;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(num);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Loading cart...</p>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-destructive mb-3" />
          <p className="text-foreground font-medium mb-3">{error}</p>
          <Link href="/">
            <Button variant="outline">Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen bg-background lg:pb-0 ${
        orderingPaused ? 'pb-44' : 'pb-32'
      }`}
    >
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href={`/${slug}`}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Back to menu"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold leading-tight truncate">Your Cart</h1>
            <p className="text-xs text-muted-foreground truncate">{restaurant.name}</p>
          </div>
          {cartItems.length > 0 && (
            <button
              onClick={clearCart}
              className="text-xs font-medium text-destructive hover:underline"
            >
              Clear
            </button>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4">
        {cartItems.length === 0 ? (
          <EmptyCart slug={slug} />
        ) : (
          <div className="space-y-4">
            {orderingPaused && (
              <OrderingPausedNotice restaurantName={restaurant.name} opensAt={opensAt} />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6">
              {/* Cart Items */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold">
                    Order Items
                    <span className="ml-2 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
                      {totalItemCount}
                    </span>
                  </h2>
                </div>

                <div className="space-y-3">
                  {cartItems.map((cartItem, index) => (
                    <CartItemCard
                      key={`${cartItem.id}-${index}`}
                      item={cartItem}
                      formatCurrency={formatCurrency}
                      getAddonQuantity={getAddonQuantity}
                      onIncrement={() => updateQuantity(index, cartItem.quantity + 1)}
                      onDecrement={() => updateQuantity(index, cartItem.quantity - 1)}
                      onRemove={() => removeFromCart(index)}
                    />
                  ))}
                </div>
              </section>

              {/* Order Summary (desktop sidebar) */}
              <aside className="hidden lg:block">
                <SummaryCard
                  subtotal={subtotal}
                  serviceFee={serviceFee}
                  total={cartTotal}
                  slug={slug}
                  formatCurrency={formatCurrency}
                  orderingPaused={orderingPaused}
                  opensAt={opensAt}
                />
              </aside>
            </div>
          </div>
        )}
      </div>

      {/* Sticky bottom checkout bar (mobile) */}
      {cartItems.length > 0 && (
        <div className="lg:hidden fixed bottom-0 inset-x-0 z-50 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
          <div className="max-w-6xl mx-auto p-4 space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground text-xs">
                <span>Service Fee</span>
                <span>+{formatCurrency(serviceFee)}</span>
              </div>
              <div className="flex justify-between font-bold pt-1.5 border-t border-border">
                <span>Total</span>
                <span className="text-primary">{formatCurrency(cartTotal)}</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Button
                onClick={() => router.push(`/${slug}/checkout`)}
                disabled={orderingPaused}
                className="w-full h-11 font-semibold"
              >
                Proceed to Checkout
              </Button>
              {orderingPaused && <OrderingPausedButtonNote opensAt={opensAt} />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------- subcomponents ------------------------------- */

function EmptyCart({ slug }: { slug: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-10 text-center max-w-md mx-auto">
      <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <ShoppingBag className="w-7 h-7 text-muted-foreground" />
      </div>
      <h2 className="font-semibold text-lg mb-1">Your cart is empty</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Browse the menu and add something delicious.
      </p>
      <Link href={`/${slug}`}>
        <Button className="h-10 px-6 font-medium">Continue Shopping</Button>
      </Link>
    </div>
  );
}

function CartItemCard({
  item,
  formatCurrency,
  getAddonQuantity,
  onIncrement,
  onDecrement,
  onRemove,
}: {
  item: CartItem;
  formatCurrency: (n: number) => string;
  getAddonQuantity: (addons: CartItem['addons'], id: string) => number;
  onIncrement: () => void;
  onDecrement: () => void;
  onRemove: () => void;
}) {
  const itemPrice = Number(item.price) || 0;
  const addonsPrice =
    item.addons?.reduce((sum, addon) => sum + (Number(addon.price) || 0), 0) || 0;
  const lineTotal = (itemPrice + addonsPrice) * item.quantity;
  const hasAddons = !!item.addons && item.addons.length > 0;

  // Deduplicate addons for display
  const uniqueAddons = hasAddons
    ? [...new Map(item.addons!.map((a) => [a.id, a])).values()]
    : [];

  return (
    <article className="bg-card border border-border rounded-2xl p-3 sm:p-4">
      <div className="flex gap-3 sm:gap-4">
        {/* Image */}
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
          {item.image_url ? (
            <Image src={item.image_url} alt={item.name} fill className="object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <ImageIcon className="w-6 h-6" />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="font-semibold text-sm sm:text-[15px] leading-tight">
                {item.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatCurrency(itemPrice)} {addonsPrice > 0 && `+ ${formatCurrency(addonsPrice)} add-ons`}
              </p>
            </div>
            <button
              onClick={onRemove}
              className="p-1.5 rounded-full hover:bg-destructive/10 text-destructive flex-shrink-0"
              aria-label={`Remove ${item.name}`}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          {/* Addons */}
          {hasAddons && (
            <ul className="mt-2 space-y-1 pl-3 border-l-2 border-border">
              {uniqueAddons.map((addon) => {
                const qty = getAddonQuantity(item.addons, addon.id);
                return (
                  <li
                    key={addon.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="text-muted-foreground truncate">
                      {addon.name}
                      {qty > 1 && <span className="ml-1 font-medium">× {qty}</span>}
                    </span>
                    <span className="font-medium text-muted-foreground flex-shrink-0">
                      +{formatCurrency(Number(addon.price) || 0)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Quantity + total */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="inline-flex items-center rounded-full border border-border bg-background overflow-hidden">
              <button
                onClick={onDecrement}
                className="px-2.5 py-1.5 hover:bg-muted disabled:opacity-50"
                aria-label="Decrease quantity"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <span className="px-3 text-sm font-semibold tabular-nums">
                {item.quantity}
              </span>
              <button
                onClick={onIncrement}
                className="px-2.5 py-1.5 hover:bg-muted"
                aria-label="Increase quantity"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-sm font-bold tabular-nums">{formatCurrency(lineTotal)}</p>
          </div>
        </div>
      </div>
    </article>
  );
}

function SummaryCard({
  subtotal,
  serviceFee,
  total,
  slug,
  formatCurrency,
  orderingPaused,
  opensAt,
}: {
  subtotal: number;
  serviceFee: number;
  total: number;
  slug: string;
  formatCurrency: (n: number) => string;
  orderingPaused: boolean;
  opensAt: string | null;
}) {
  return (
    <div className="bg-card border border-border rounded-2xl p-5 sticky top-20 space-y-4">
      <h2 className="font-bold text-sm">Order Summary</h2>

      <div className="space-y-2.5 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium tabular-nums">{formatCurrency(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Service Fee</span>
          <span className="font-medium tabular-nums">+{formatCurrency(serviceFee)}</span>
        </div>
        <div className="flex justify-between pt-3 border-t border-border">
          <span className="font-bold">Total</span>
          <span className="font-bold text-primary text-lg tabular-nums">
            {formatCurrency(total)}
          </span>
        </div>
      </div>

      {orderingPaused ? (
        <div className="space-y-2">
          <Button disabled className="w-full h-11 font-semibold">
            Proceed to Checkout
          </Button>
          <OrderingPausedButtonNote opensAt={opensAt} />
        </div>
      ) : (
        <Link href={`/${slug}/checkout`} className="block">
          <Button className="w-full h-11 font-semibold">Proceed to Checkout</Button>
        </Link>
      )}

      <Link href={`/${slug}`} className="block">
        <Button variant="outline" className="w-full h-10 text-sm">
          Continue Shopping
        </Button>
      </Link>

      <div className="flex items-center gap-2 pt-2 text-[11px] text-muted-foreground">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>Secure checkout via Paystack</span>
      </div>
    </div>
  );
}
