'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ShoppingCart, ArrowLeft, AlertCircle } from 'lucide-react';

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
  description?: string;
}

export default function RestaurantPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cart, setCart] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    fetchRestaurantData();
  }, [slug]);

  const fetchRestaurantData = async () => {
    try {
      const response = await fetch(`/api/restaurants/${slug}/menu`);
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setRestaurant(data.restaurant);
      setMenuItems(data.menuItems || []);
    } catch (err) {
      setError('Restaurant not found or error loading menu');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (itemId: string) => {
    const newCart = new Map(cart);
    newCart.set(itemId, (newCart.get(itemId) || 0) + 1);
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
        <p className="text-muted-foreground">Loading menu...</p>
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
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-primary hover:text-primary-dark">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-xs font-medium">Back</span>
          </Link>
          <h1 className="text-lg font-bold">{restaurant.name}</h1>
          <div className="w-12 flex justify-end">
            {cart.size > 0 && (
              <span className="bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {cart.size}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-4">
          {/* Menu */}
          <div className="lg:col-span-2 space-y-3">
            <div className="bg-white rounded-lg p-4">
              <h2 className="text-lg font-bold mb-2">{restaurant.name}</h2>
              {restaurant.description && (
                <p className="text-xs text-muted-foreground">{restaurant.description}</p>
              )}
            </div>

            {menuItems.length === 0 ? (
              <div className="bg-white rounded-lg p-8 text-center">
                <p className="text-sm text-muted-foreground">No menu items available</p>
              </div>
            ) : (
              <div className="space-y-2">
                {menuItems.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white border border-border rounded-lg p-3 flex gap-3 items-start hover:shadow-sm transition-shadow"
                  >
                    {item.image_url && (
                      <div className="relative w-20 h-20 rounded flex-shrink-0">
                        <Image
                          src={item.image_url}
                          alt={item.name}
                          fill
                          className="object-cover rounded"
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm">{item.name}</h3>
                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {item.description}
                        </p>
                      )}
                      <p className="text-sm font-semibold text-primary mt-1">
                        {formatCurrency(item.price)}
                      </p>
                    </div>
                    <Button
                      onClick={() => addToCart(item.id)}
                      size="sm"
                      className="flex-shrink-0 h-8 text-xs bg-primary text-white hover:bg-primary-dark"
                    >
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-border rounded-lg p-4 sticky top-20 space-y-3">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" />
                Your Order
              </h2>

              {cart.size === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Your cart is empty
                </p>
              ) : (
                <>
                  <div className="space-y-2 border-b border-border pb-3 max-h-96 overflow-y-auto">
                    {Array.from(cart.entries()).map(([itemId, qty]) => {
                      const item = menuItems.find((m) => m.id === itemId);
                      if (!item) return null;
                      return (
                        <div key={itemId} className="flex justify-between items-center text-xs">
                          <div>
                            <p className="font-medium">{item.name}</p>
                            <p className="text-muted-foreground">Qty: {qty}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(item.price * qty)}</p>
                            <button
                              onClick={() => removeFromCart(itemId)}
                              className="text-red-600 hover:text-red-700 text-xs mt-1"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-sm font-bold">
                      <span>Total:</span>
                      <span>{formatCurrency(cartTotal)}</span>
                    </div>
                    <Link href={`/${slug}/checkout`}>
                      <Button className="w-full h-9 text-xs bg-primary text-white hover:bg-primary-dark">
                        Checkout
                      </Button>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
