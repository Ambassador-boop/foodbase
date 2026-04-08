'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ShoppingCart, ArrowLeft, AlertCircle, Wine } from 'lucide-react';
import { AddonSelectionModal } from '@/components/addon-selection-modal';
import { DiscountBadge, DiscountPriceDisplay } from '@/components/discount-badge';
import { useToast } from '@/hooks/use-toast';
import { fetchColorConfig, type ColorConfig, DEFAULT_COLORS } from '@/lib/color-config';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  original_price?: number | null;
  image_url?: string;
  addons?: any[];
  order_count?: number;
  is_popular?: boolean;
  category_id?: string;
  category_name?: string;
  discount_type?: string | null;
  discount_value?: number | null;
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

interface Category {
  id: string;
  name: string;
  display_order: number;
}

export default function RestaurantPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { toast } = useToast();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [showDrinks, setShowDrinks] = useState(false);
  const [selectedItemForAddons, setSelectedItemForAddons] = useState<MenuItem | null>(null);
  const [colors, setColors] = useState<ColorConfig>(DEFAULT_COLORS);

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
  }, [slug]);

  useEffect(() => {
    sessionStorage.setItem(`cart_${slug}`, JSON.stringify(cartItems));
  }, [cartItems, slug]);



  const fetchRestaurantData = async () => {
    try {
      console.log('[v0] Client: Fetching menu for slug:', slug);
      const response = await fetch(`/api/restaurants/${slug}/menu`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch menu');
      }

      setRestaurant(data.business);
      setMenuItems(data.menuItems || []);
      setDrinks(data.drinks || []);
      setCategories(data.categories || []);

      // Fetch color configuration for this business
      if (data.business && data.business.id) {
        const colorConfig = await fetchColorConfig(data.business.id, 'menu');
        setColors(colorConfig);
      }
    } catch (err) {
      console.error('[v0] Error fetching menu:', err);
      setError('Restaurant not found or error loading menu');
    } finally {
      setLoading(false);
    }
  };

  const handleDrinkAdd = (drinkId: string) => {
    const drink = drinks.find((d) => d.id === drinkId);
    if (drink) {
      addDrinkToCart(drink);
      toast({
        title: 'Added to cart',
        description: `${drink.name} has been added to your cart`,
      });
    }
  };

  const addToCart = (itemId: string) => {
    const item = menuItems.find((m) => m.id === itemId);
    if (item) {
      const existingCartItem = cartItems.find(
        (ci) => ci.id === itemId && ci.type === 'menu' && (!ci.addons || ci.addons.length === 0)
      );

      if (existingCartItem) {
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
            price: item.discounted_price || item.price,
            image_url: item.image_url,
            quantity: 1,
            addons: [],
          },
        ]);
      }
      toast({
        title: 'Added to cart',
        description: `${item.name} has been added to your cart`,
      });
    }
  };

  const addDrinkToCart = (drink: Drink) => {
    const existingCartItem = cartItems.find(
      (ci) => ci.id === `drink_${drink.id}` && ci.type === 'drink'
    );

    if (existingCartItem) {
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

      const addonsKey = addonsArray.map((a) => a.id).sort().join('-');
      const cartKey = `${itemId}_${addonsKey}`;
      const existingCartItem = cartItems.find((ci) => ci.cartKey === cartKey);

      if (existingCartItem) {
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
            price: item.discounted_price || item.price,
            image_url: item.image_url,
            quantity: 1,
            addons: addonsArray,
          },
        ]);
      }
    }
  };

  // Get most ordered items for "Popular" tag
  const getMostOrderedItems = () => {
    if (menuItems.length === 0) return new Set();
    const avgOrders = menuItems.reduce((sum, item) => sum + (item.order_count || 0), 0) / menuItems.length;
    return new Set(
      menuItems
        .filter((item) => (item.order_count || 0) > avgOrders)
        .map((item) => item.id)
    );
  };

  const mostOrderedItems = getMostOrderedItems();

  // Group menu items by category
  const groupedItems = categories.map((cat) => ({
    category: cat,
    items: menuItems.filter((item) => item.category_id === cat.id),
  })).filter((group) => group.items.length > 0);

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
    <div className="min-h-screen pb-20 md:pb-0" style={{ backgroundColor: colors.backgroundColor }}>
      {/* Header */}
      <header style={{ backgroundColor: colors.headerColor }} className="border-b-2 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold" style={{ color: colors.headerTextColor }}>{restaurant.name}</h1>
            {drinks.length > 0 && (
              <button
                onClick={() => setShowDrinks(!showDrinks)}
                style={{
                  backgroundColor: showDrinks ? colors.buttonColor : colors.headerColor,
                  color: showDrinks ? colors.buttonTextColor : colors.headerTextColor,
                  borderColor: colors.accentColor,
                }}
                className="text-xs px-2 py-1 rounded border transition-colors hover:opacity-80"
                title="Toggle drinks view"
              >
                <Wine className="w-3 h-3 inline mr-1" />
                Drinks
              </button>
            )}
          </div>
          <Link href={`/${slug}/cart`} className="relative p-2" style={{ color: colors.buttonColor }}>
            <ShoppingCart className="w-5 h-5" />
            {cartItems.length > 0 && (
              <span 
                style={{ backgroundColor: colors.buttonColor, color: colors.buttonTextColor }}
                className="absolute top-0 right-0 text-xs rounded-full w-5 h-5 flex items-center justify-center"
              >
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
            <div style={{ backgroundColor: colors.headerColor }} className="rounded-lg p-4">
              <h2 className="text-lg font-bold mb-2" style={{ color: colors.headerTextColor }}>{showDrinks ? 'Drinks' : 'Our Menu'}</h2>
            </div>

            {showDrinks ? (
              // Drinks Display
              drinks.length === 0 ? (
                <div style={{ backgroundColor: colors.headerColor }} className="rounded-lg p-8 text-center">
                  <p className="text-sm" style={{ color: colors.textColor }}>No drinks available</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {drinks.map((drink) => (
                    <div
                      key={drink.id}
                      style={{ backgroundColor: colors.headerColor, borderColor: colors.accentColor }}
                      className="border-2 rounded-lg overflow-hidden flex flex-col hover:shadow-sm transition-shadow"
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
                        <h3 className="font-medium text-xs line-clamp-2" style={{ color: colors.textColor }}>{drink.name}</h3>
                        {drink.description && (
                          <p className="text-xs line-clamp-1 mt-0.5" style={{ color: colors.textColor, opacity: 0.75 }}>
                            {drink.description}
                          </p>
                        )}
                        <p className="text-xs font-semibold mt-auto mb-2" style={{ color: colors.accentColor }}>
                          {formatCurrency(drink.price)}
                        </p>
                        <Button
                          onClick={() => handleDrinkAdd(drink.id)}
                          size="sm"
                          style={{ backgroundColor: colors.buttonColor, color: colors.buttonTextColor }}
                          className="h-7 text-xs w-full hover:opacity-90"
                        >
                          Add
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : (
              // Menu Items Display with Category Grouping
              menuItems.length === 0 ? (
                <div style={{ backgroundColor: colors.headerColor }} className="rounded-lg p-8 text-center">
                  <p className="text-sm" style={{ color: colors.textColor }}>No menu items available</p>
                </div>
              ) : groupedItems.length > 0 ? (
                <div className="space-y-6">
                  {groupedItems.map((group) => (
                    <div key={group.category.id} className="space-y-3">
                      {/* Category Header */}
                      <div style={{ backgroundColor: colors.buttonColor }} className="sticky top-16 z-30 py-2 px-4 rounded-lg">
                        <h3 className="font-semibold text-xs" style={{ color: colors.buttonTextColor }}>{group.category.name}</h3>
                      </div>

                      {/* Items Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {group.items.map((item) => (
                          <div
                            key={item.id}
                            style={{ backgroundColor: colors.headerColor, borderColor: colors.accentColor }}
                            className="border-2 rounded-lg overflow-hidden flex flex-col hover:shadow-sm transition-shadow relative"
                          >
                            {/* Image Container */}
                            {item.image_url && (
                              <div className="relative w-full aspect-square rounded-t flex-shrink-0">
                                <Image
                                  src={item.image_url}
                                  alt={item.name}
                                  fill
                                  className="object-cover"
                                />
                                {/* Popular Tag */}
                                {mostOrderedItems.has(item.id) && (
                                  <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                                    Popular
                                  </div>
                                )}
                                {/* Discount Badge */}
                                {item.discount_type && item.discount_value && (
                                  <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                                    {item.discount_type === 'percentage'
                                      ? `${item.discount_value}% Off`
                                      : `-₦${Number(item.discount_value).toFixed(2)}`}
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="p-2 flex-1 flex flex-col">
                              <h3 className="font-medium text-xs line-clamp-2" style={{ color: colors.textColor }}>{item.name}</h3>
                              {item.description && (
                                <p className="text-xs line-clamp-1 mt-0.5" style={{ color: colors.textColor, opacity: 0.75 }}>
                                  {item.description}
                                </p>
                              )}
                              <div className="mt-auto mb-2">
                                {item.discount_type && item.original_price ? (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-xs line-through" style={{ color: colors.textColor, opacity: 0.6 }}>
                                      {formatCurrency(item.original_price)}
                                    </span>
                                    <span className="text-xs font-bold" style={{ color: colors.accentColor }}>
                                      {formatCurrency(item.price)}
                                    </span>
                                  </div>
                                ) : (
                                  <p className="text-xs font-semibold" style={{ color: colors.accentColor }}>
                                    {formatCurrency(item.price)}
                                  </p>
                                )}
                              </div>
                              <Button
                                onClick={() => {
                                  if (item.addons && item.addons.length > 0) {
                                    window.location.href = `/${slug}/add-on?itemId=${item.id}`;
                                  } else {
                                    addToCart(item.id);
                                  }
                                }}
                                size="sm"
                                style={{ backgroundColor: colors.buttonColor, color: colors.buttonTextColor }}
                                className="h-7 text-xs w-full hover:opacity-90"
                              >
                                Add
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {menuItems.map((item) => (
                    <div
                      key={item.id}
                      className="bg-white border border-border rounded-lg overflow-hidden flex flex-col hover:shadow-sm transition-shadow relative"
                    >
                      {item.image_url && (
                        <div className="relative w-full aspect-square rounded-t flex-shrink-0">
                          <Image
                            src={item.image_url}
                            alt={item.name}
                            fill
                            className="object-cover"
                          />
                          {mostOrderedItems.has(item.id) && (
                            <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                              Popular
                            </div>
                          )}
                          {item.discount_type && item.discount_value && (
                            <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                              {item.discount_type === 'percentage'
                                ? `${item.discount_value}% Off`
                                : `-₦${Number(item.discount_value).toFixed(2)}`}
                            </div>
                          )}
                        </div>
                      )}
                      <div className="p-2 flex-1 flex flex-col">
                        <h3 className="font-medium text-xs line-clamp-2">{item.name}</h3>
                        {item.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                            {item.description}
                          </p>
                        )}
                        <div className="mt-auto mb-2">
                          {item.discount_type && item.original_price ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs line-through text-gray-500">
                                {formatCurrency(item.original_price)}
                              </span>
                              <span className="text-xs font-bold text-green-600">
                                {formatCurrency(item.price)}
                              </span>
                            </div>
                          ) : (
                            <p className="text-xs font-semibold text-primary">
                              {formatCurrency(item.price)}
                            </p>
                          )}
                        </div>
                        <Button
                          onClick={() => {
                            if (item.addons && item.addons.length > 0) {
                              window.location.href = `/${slug}/add-on?itemId=${item.id}`;
                            } else {
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

      {/* Floating Cart Icon (Bottom Right) */}
      {cartItems.length > 0 && (
        <Link
          href={`/${slug}/cart`}
          className="fixed bottom-4 right-4 z-50 bg-primary text-primary-foreground p-2 rounded-full shadow-lg hover:shadow-xl transition-shadow"
          title="View cart"
        >
          <div className="relative">
            <ShoppingCart className="w-4 h-4" />
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {cartItems.length}
            </span>
          </div>
        </Link>
      )}
    </div>
  );
}
