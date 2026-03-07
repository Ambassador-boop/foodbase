'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ShoppingCart, ArrowLeft, AlertCircle, Wine } from 'lucide-react';
import { AddonSelectionModal } from '@/components/addon-selection-modal';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  addons?: any[];
}

interface Drink {
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
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [showDrinks, setShowDrinks] = useState(false);
  const [selectedItemForAddons, setSelectedItemForAddons] = useState<MenuItem | null>(null);

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
    fetchRestaurantData();
  }, [slug]);

  // Save cart to storage whenever it changes
  useEffect(() => {
    sessionStorage.setItem(`cart_${slug}`, JSON.stringify(cartItems));
  }, [cartItems, slug]);

  const fetchRestaurantData = async () => {
    try {
      console.log('[v0] Client: Fetching menu for slug:', slug);
      const response = await fetch(`/api/restaurants/${slug}/menu`);
      console.log('[v0] Client: API response status:', response.status);
      const data = await response.json();
      console.log('[v0] Client: API response data:', data);

      if (!response.ok) {
        console.log('[v0] Client: API returned error:', data.error);
        throw new Error(data.error || 'Failed to fetch menu');
      }

      console.log('[v0] Client: Setting restaurant data:', data.business?.name);
      setRestaurant(data.business);
      setMenuItems(data.menuItems || []);
      setDrinks(data.drinks || []);
      console.log('[v0] Client: Menu items set:', data.menuItems?.length || 0);
    } catch (err) {
      console.error('[v0] Client: Error fetching menu:', err);
      setError('Restaurant not found or error loading menu');
    } finally {
      setLoading(false);
    }
  };

  const handleDrinkAdd = (drinkId: string) => {
    const drink = drinks.find((d) => d.id === drinkId);
    if (drink) {
      addDrinkToCart(drink);
    }
  };

  const addToCart = (itemId: string) => {
    const item = menuItems.find((m) => m.id === itemId);
    if (item) {
      const existingCartItem = cartItems.find(
        (ci) => ci.id === itemId && ci.type === 'menu' && (!ci.addons || ci.addons.length === 0)
      );

      if (existingCartItem) {
        // Item already in cart, increase quantity
        const newItems = cartItems.map((ci) =>
          ci === existingCartItem ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
        setCartItems(newItems);
      } else {
        setCartItems([
          ...cartItems,
          {
            id: itemId,
            type: 'menu',
            name: item.name,
            price: item.price,
            image_url: item.image_url,
            quantity: 1,
            addons: [],
          },
        ]);
      }
    }
  };

  const addDrinkToCart = (drink: Drink) => {
    const existingCartItem = cartItems.find(
      (ci) => ci.id === `drink_${drink.id}` && ci.type === 'drink'
    );

    if (existingCartItem) {
      // Drink already in cart, increase quantity
      const newItems = cartItems.map((ci) =>
        ci === existingCartItem ? { ...ci, quantity: ci.quantity + 1 } : ci
      );
      setCartItems(newItems);
    } else {
      setCartItems([
        ...cartItems,
        {
          id: `drink_${drink.id}`,
          type: 'drink',
          name: drink.name,
          price: drink.price,
          image_url: drink.image_url,
          quantity: 1,
          addons: [],
        },
      ]);
    }
  };

  const addToCartWithAddons = (itemId: string, selectedAddons: any) => {
    const item = menuItems.find((m) => m.id === itemId);
    if (item) {
      const addonsArray: any[] = [];
      item.addons?.forEach((addon) => {
        if (selectedAddons[addon.id]) {
          const selected = selectedAddons[addon.id];
          if (Array.isArray(selected)) {
            selected.forEach((optionId: string) => {
              const option = addon.options?.find((o: any) => o.id === optionId);
              if (option) {
                addonsArray.push({
                  id: option.id,
                  name: option.name,
                  price: option.price,
                  image_url: option.image_url,
                });
              }
            });
          } else {
            const option = addon.options?.find((o: any) => o.id === selected);
            if (option) {
              addonsArray.push({
                id: option.id,
                name: option.name,
                price: option.price,
                image_url: option.image_url,
              });
            }
          }
        }
      });

      // Create a unique key for this item + addons combination
      const addonsKey = addonsArray.map((a) => a.id).sort().join('-');
      const cartKey = `${itemId}_${addonsKey}`;

      const existingCartItem = cartItems.find((ci) => ci.cartKey === cartKey);

      if (existingCartItem) {
        // Same item with same addons exists, increase quantity
        const newItems = cartItems.map((ci) =>
          ci === existingCartItem ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
        setCartItems(newItems);
      } else {
        setCartItems([
          ...cartItems,
          {
            id: itemId,
            cartKey,
            type: 'menu',
            name: item.name,
            price: item.price,
            image_url: item.image_url,
            quantity: 1,
            addons: addonsArray,
          },
        ]);
      }
    }
  };

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
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold">{restaurant.name}</h1>
            {drinks.length > 0 && (
              <button
                onClick={() => setShowDrinks(!showDrinks)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  showDrinks
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-foreground border-border hover:bg-muted'
                }`}
                title="Toggle drinks view"
              >
                <Wine className="w-3 h-3 inline mr-1" />
                Drinks
              </button>
            )}
          </div>
          <Link href={`/${slug}/cart`} className="relative p-2 text-primary hover:text-primary-dark">
            <ShoppingCart className="w-5 h-5" />
            {cartItems.length > 0 && (
              <span className="absolute top-0 right-0 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {cartItems.length}
              </span>
            )}
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 gap-6 p-4">
          {/* Menu or Drinks */}
          <div className="space-y-3">
            <div className="bg-white rounded-lg p-4">
              <h2 className="text-lg font-bold mb-2">{showDrinks ? 'Drinks' : 'Our Menu'}</h2>
            </div>

            {showDrinks ? (
              // Drinks Display
              drinks.length === 0 ? (
                <div className="bg-white rounded-lg p-8 text-center">
                  <p className="text-sm text-muted-foreground">No drinks available</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {drinks.map((drink) => (
                    <div
                      key={drink.id}
                      className="bg-white border border-border rounded-lg overflow-hidden flex flex-col hover:shadow-sm transition-shadow"
                    >
                      {drink.image_url && (
                        <div className="relative w-full aspect-square rounded-t flex-shrink-0">
                          <Image
                            src={drink.image_url}
                            alt={drink.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="p-2 flex-1 flex flex-col">
                        <h3 className="font-medium text-xs line-clamp-2">{drink.name}</h3>
                        {drink.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {drink.description}
                          </p>
                        )}
                        <p className="text-xs font-semibold text-primary mt-auto mb-2">
                          {formatCurrency(drink.price)}
                        </p>
                        <Button
                          onClick={() => handleDrinkAdd(drink.id)}
                          size="sm"
                          className="h-7 text-xs bg-primary text-white hover:bg-primary-dark w-full"
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              // Menu Items Display
              menuItems.length === 0 ? (
                <div className="bg-white rounded-lg p-8 text-center">
                  <p className="text-sm text-muted-foreground">No menu items available</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {menuItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white border border-border rounded-lg overflow-hidden flex flex-col hover:shadow-sm transition-shadow"
                    >
                      {item.image_url && (
                        <div className="relative w-full aspect-square rounded-t flex-shrink-0">
                          <Image
                            src={item.image_url}
                            alt={item.name}
                            fill
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="p-2 flex-1 flex flex-col">
                        <h3 className="font-medium text-xs line-clamp-2">{item.name}</h3>
                        {item.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {item.description}
                          </p>
                        )}
                        <p className="text-xs font-semibold text-primary mt-auto mb-2">
                          {formatCurrency(item.price)}
                        </p>
                        <Button
                          onClick={() => {
                            if (item.addons && item.addons.length > 0) {
                              // Navigate to add-on page
                              window.location.href = `/${slug}/add-on?itemId=${item.id}`;
                            } else {
                              // Add directly to cart
                              addToCart(item.id);
                            }
                          }}
                          size="sm"
                          className="h-7 text-xs bg-primary text-white hover:bg-primary-dark w-full"
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>

          {/* Add-ons Selection Modal */}
          {selectedItemForAddons && (
            <AddonSelectionModal
              item={selectedItemForAddons}
              addons={selectedItemForAddons.addons || []}
              onClose={() => setSelectedItemForAddons(null)}
              onAddToCart={(config) => {
                addToCartWithAddons(config.itemId, config.selectedAddons);
                setSelectedItemForAddons(null);
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
