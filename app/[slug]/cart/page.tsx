'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Trash2, Plus, Minus, AlertCircle } from 'lucide-react';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
}

interface Restaurant {
  id: string;
  name: string;
  slug: string;
}

export default function CartPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    // Get cart from localStorage or sessionStorage
    const storedCart = sessionStorage.getItem(`cart_${slug}`);
    if (storedCart) {
      try {
        const cartData = JSON.parse(storedCart);
        setCart(new Map(Object.entries(cartData)));
      } catch {
        setCart(new Map());
      }
    }
    fetchRestaurantData();
  }, [slug]);

  // Save cart to storage whenever it changes
  useEffect(() => {
    const cartObj = Object.fromEntries(cart);
    sessionStorage.setItem(`cart_${slug}`, JSON.stringify(cartObj));
  }, [cart, slug]);

  const fetchRestaurantData = async () => {
    try {
      const response = await fetch(`/api/restaurants/${slug}/menu`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch menu');
      }

      setRestaurant(data.business);
      setMenuItems(data.menuItems || []);
    } catch (err) {
      console.error('Error fetching menu:', err);
      setError('Restaurant not found or error loading cart');
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = (itemId: string, quantity: number) => {
    const newCart = new Map(cart);
    if (quantity <= 0) {
      newCart.delete(itemId);
    } else {
      newCart.set(itemId, quantity);
    }
    setCart(newCart);
  };

  const removeFromCart = (itemId: string) => {
    const newCart = new Map(cart);
    newCart.delete(itemId);
    setCart(newCart);
  };

  const cartTotal = Array.from(cart.entries()).reduce((total, [itemId, qty]) => {
    const item = menuItems.find((m) => m.id === itemId);
    return total + (item?.price || 0) * qty;
  }, 0);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading cart...</p>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
          <p className="text-foreground font-medium mb-3">{error}</p>
          <Link href="/">
            <Button variant="outline">Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Link href={`/${slug}`} className="flex items-center gap-2 text-primary hover:text-primary-dark">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <h1 className="text-lg font-bold">Your Cart - {restaurant.name}</h1>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-4">
        {cart.size === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-muted-foreground mb-4">Your cart is empty</p>
            <Link href={`/${slug}`}>
              <Button className="bg-primary text-white hover:bg-primary-dark">
                Continue Shopping
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Cart Items */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-lg overflow-hidden">
                <div className="border-b border-border p-4">
                  <h2 className="font-bold text-sm">Order Items ({cart.size})</h2>
                </div>

                <div className="divide-y divide-border max-h-96 overflow-y-auto">
                  {Array.from(cart.entries()).map(([itemId, qty]) => {
                    const item = menuItems.find((m) => m.id === itemId);
                    if (!item) return null;

                    return (
                      <div key={itemId} className="p-4 flex gap-4">
                        {/* Item Image */}
                        {item.image_url && (
                          <div className="relative w-20 h-20 rounded overflow-hidden flex-shrink-0">
                            <Image
                              src={item.image_url}
                              alt={item.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                        )}

                        {/* Item Details */}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium text-sm line-clamp-2">{item.name}</h3>
                          {item.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                              {item.description}
                            </p>
                          )}
                          <p className="text-xs font-semibold text-primary mt-2">
                            {formatCurrency(item.price)}
                          </p>
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex flex-col items-end gap-2">
                          <div className="flex items-center gap-2 border border-border rounded">
                            <button
                              onClick={() => updateQuantity(itemId, qty - 1)}
                              className="p-1 hover:bg-muted text-muted-foreground"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-medium w-6 text-center">{qty}</span>
                            <button
                              onClick={() => updateQuantity(itemId, qty + 1)}
                              className="p-1 hover:bg-muted text-muted-foreground"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <button
                            onClick={() => removeFromCart(itemId)}
                            className="text-red-600 hover:text-red-700 text-xs font-medium flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Remove
                          </button>

                          <p className="text-xs font-bold mt-2">
                            {formatCurrency(item.price * qty)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="bg-white border border-border rounded-lg p-4 sticky top-20 space-y-4">
                <h2 className="font-bold text-sm">Order Summary</h2>

                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span className="font-medium">{formatCurrency(cartTotal)}</span>
                  </div>

                  <div className="flex justify-between text-xs border-t border-border pt-3">
                    <span className="font-bold">Total:</span>
                    <span className="font-bold text-primary text-sm">{formatCurrency(cartTotal)}</span>
                  </div>
                </div>

                <Link href={`/${slug}/checkout`} className="w-full block">
                  <Button className="w-full h-9 text-xs bg-primary text-white hover:bg-primary-dark">
                    Proceed to Checkout
                  </Button>
                </Link>

                <Link href={`/${slug}`} className="w-full block">
                  <Button variant="outline" className="w-full h-9 text-xs">
                    Continue Shopping
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
