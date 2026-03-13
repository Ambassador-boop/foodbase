'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, AlertCircle, Plus, Minus } from 'lucide-react';

interface AddonOption {
  id: string;
  name: string;
  price: number;
  image_url?: string;
}

interface Addon {
  id: string;
  name: string;
  description?: string;
  is_required: boolean;
  addon_type: string;
  allow_multiple: boolean;
  options: AddonOption[];
  image_url?: string;
}

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  addons?: any[];
}

interface Restaurant {
  id: string;
  name: string;
  slug: string;
}

export default function AddonPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const itemId = searchParams.get('itemId');

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<Record<string, string | string[]>>({});
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    if (!itemId) {
      setError('No menu item selected');
      setLoading(false);
      return;
    }
    fetchRestaurantData();
  }, [slug, itemId]);

  const fetchRestaurantData = async () => {
    try {
      console.log('[v0] Add-on page: Fetching menu for slug:', slug);
      const response = await fetch(`/api/restaurants/${slug}/menu`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch menu');
      }

      setRestaurant(data.business);
      setMenuItems(data.menuItems || []);

      // Find the selected item
      const item = data.menuItems?.find((m: MenuItem) => m.id === itemId);
      if (item) {
        setSelectedItem(item);

        // Fetch addons for this item
        if (item.addons && item.addons.length > 0) {
          await fetchAddons(item.addons);
        }
      } else {
        setError('Menu item not found');
      }
    } catch (err) {
      console.error('[v0] Add-on page error:', err);
      setError('Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  const fetchAddons = async (addonRefs: any[]) => {
    try {
      // Fetch addon details for each addon
      const addonDetailsPromises = addonRefs.map(async (addon) => {
        const response = await fetch(`/api/public/addons/${addon.id}`);
        if (response.ok) {
          const data = await response.json();
          console.log('[v0] Add-on page: Fetched addon:', data.name, 'with options:', data.options?.length || 0);
          data.options?.forEach((opt: any) => {
            console.log('[v0] Option:', opt.name, 'Price:', opt.price, 'Image:', opt.image_url);
          });
          return {
            id: data.id,
            name: data.name,
            description: data.description,
            is_required: data.is_required,
            addon_type: data.addon_type,
            allow_multiple: data.allow_multiple,
            image_url: data.image_url,
            options: data.options || [],
          };
        }
        return addon;
      });

      const addonDetails = await Promise.all(addonDetailsPromises);
      console.log('[v0] Add-on page: All addons loaded:', addonDetails.length);
      setAddons(addonDetails);
    } catch (err) {
      console.error('[v0] Error fetching addon details:', err);
      setAddons(addonRefs);
    }
  };

  const handleOptionSelect = (addonId: string, optionId: string, allowMultiple: boolean) => {
    setSelectedAddons((prev) => {
      const current = prev[addonId];
      if (allowMultiple) {
        if (Array.isArray(current)) {
          return {
            ...prev,
            [addonId]: current.includes(optionId)
              ? current.filter((id) => id !== optionId)
              : [...current, optionId],
          };
        } else {
          return {
            ...prev,
            [addonId]: [optionId],
          };
        }
      } else {
        return {
          ...prev,
          [addonId]: current === optionId ? undefined : optionId,
        };
      }
    });
  };

  const handleAddToCart = () => {
    // Validate required addons
    for (const addon of addons) {
      if (addon.is_required && !selectedAddons[addon.id]) {
        alert(`${addon.name} is required`);
        return;
      }
    }

    if (!selectedItem) return;

    // Get cart from sessionStorage
    const storedCart = sessionStorage.getItem(`cart_${slug}`);
    let cartItems = [];
    try {
      cartItems = storedCart ? JSON.parse(storedCart) : [];
    } catch {
      cartItems = [];
    }

    // Build addons array
    const addonsArray: any[] = [];
    addons.forEach((addon) => {
      if (selectedAddons[addon.id]) {
        const selected = selectedAddons[addon.id];
        if (Array.isArray(selected)) {
          selected.forEach((optionId: string) => {
            const option = addon.options?.find((o: any) => o.id === optionId);
            if (option) {
              console.log('[v0] Adding addon option to cart:', option.name, 'with image:', option.image_url);
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
            console.log('[v0] Adding addon option to cart:', option.name, 'with image:', option.image_url);
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
    
    console.log('[v0] Final addons array for cart:', addonsArray);

    // Create a unique key for this item + addons combination
    const addonsKey = addonsArray.map((a) => a.id).sort().join('-');
    const cartKey = `${selectedItem.id}_${addonsKey}`;

    const existingCartItem = cartItems.find((ci: any) => ci.cartKey === cartKey);

    if (existingCartItem) {
      // Same item with same addons exists, increase quantity
      const newItems = cartItems.map((ci: any) =>
        ci === existingCartItem ? { ...ci, quantity: ci.quantity + quantity } : ci
      );
      sessionStorage.setItem(`cart_${slug}`, JSON.stringify(newItems));
    } else {
      cartItems.push({
        id: selectedItem.id,
        cartKey,
        type: 'menu',
        name: selectedItem.name,
        price: selectedItem.price,
        image_url: selectedItem.image_url,
        quantity,
        addons: addonsArray,
      });
      sessionStorage.setItem(`cart_${slug}`, JSON.stringify(cartItems));
    }

    // Redirect back to restaurant page
    router.push(`/${slug}`);
  };

  const calculateAddonsPrice = () => {
    let total = 0;
    addons.forEach((addon) => {
      const selected = selectedAddons[addon.id];
      if (selected) {
        if (Array.isArray(selected)) {
          selected.forEach((optionId) => {
            const option = addon.options?.find((o) => o.id === optionId);
            if (option) total += option.price;
          });
        } else {
          const option = addon.options?.find((o) => o.id === selected);
          if (option) total += option.price;
        }
      }
    });
    return total;
  };

  const getSelectedAddonsDetails = () => {
    const details: Array<{
      id: string;
      name: string;
      price: number;
      count: number;
    }> = [];

    addons.forEach((addon) => {
      const selected = selectedAddons[addon.id];
      if (selected) {
        if (Array.isArray(selected)) {
          selected.forEach((optionId) => {
            const option = addon.options?.find((o) => o.id === optionId);
            if (option) {
              const existing = details.find((d) => d.id === option.id);
              if (existing) {
                existing.count++;
              } else {
                details.push({
                  id: option.id,
                  name: option.name,
                  price: option.price,
                  count: 1,
                });
              }
            }
          });
        } else {
          const option = addon.options?.find((o) => o.id === selected);
          if (option) {
            details.push({
              id: option.id,
              name: option.name,
              price: option.price,
              count: 1,
            });
          }
        }
      }
    });

    return details;
  };

  const addonsPrice = calculateAddonsPrice();
  const selectedAddonsDetails = getSelectedAddonsDetails();
  const itemPrice = selectedItem?.price || 0;
  const pricePerUnit = itemPrice + addonsPrice;
  const totalPrice = pricePerUnit * quantity;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading add-ons...</p>
      </div>
    );
  }

  if (error || !selectedItem) {
    return (
      <div className="min-h-screen bg-background">
        <header className="bg-white border-b border-border sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
            <Link href={`/${slug}`} className="p-1 hover:bg-muted rounded">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-bold">Add-ons</h1>
          </div>
        </header>
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
            <p className="text-foreground font-medium mb-3">{error}</p>
            <Link href={`/${slug}`}>
              <Button variant="outline">Back to Menu</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-40">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link href={`/${slug}`} className="p-1 hover:bg-muted rounded">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-bold">Select Add-ons</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Menu Item Display */}
        <div className="bg-white rounded-lg p-4 mb-6">
          <div className="flex gap-4">
            {selectedItem.image_url && (
              <div className="relative w-24 h-24 rounded overflow-hidden flex-shrink-0">
                <Image
                  src={selectedItem.image_url}
                  alt={selectedItem.name}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-sm font-bold">{selectedItem.name}</h2>
              {selectedItem.description && (
                <p className="text-xs text-muted-foreground mt-1">{selectedItem.description}</p>
              )}
              <p className="text-sm font-semibold text-primary mt-2">
                {formatCurrency(selectedItem.price)}
              </p>
            </div>
          </div>
        </div>

        {/* Add-ons Selection */}
        {addons.length === 0 ? (
          <div className="bg-white rounded-lg p-8 text-center">
            <p className="text-sm text-muted-foreground">No add-ons available for this item</p>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            {addons.map((addon) => (
              <div key={addon.id} className="bg-white rounded-lg p-4 border border-border">
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide">
                    {addon.name}
                  </h3>
                  {addon.is_required && (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                      Required
                    </span>
                  )}
                </div>
                {addon.description && (
                  <p className="text-xs text-muted-foreground mb-3">{addon.description}</p>
                )}

                <div className="space-y-2">
                  {addon.options.map((option) => {
                    const selected = Array.isArray(selectedAddons[addon.id])
                      ? (selectedAddons[addon.id] as string[]).includes(option.id)
                      : selectedAddons[addon.id] === option.id;

                    return (
                      <div
                        key={option.id}
                        className="flex items-center gap-3 p-3 rounded border border-border hover:bg-muted cursor-pointer"
                      >
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() =>
                            handleOptionSelect(addon.id, option.id, addon.allow_multiple)
                          }
                          className="w-4 h-4 flex-shrink-0"
                        />

                        {option.image_url && (
                          <div className="relative w-12 h-12 rounded overflow-hidden flex-shrink-0">
                            <Image
                              src={option.image_url}
                              alt={option.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium">{option.name}</p>
                        </div>

                        {option.price > 0 && (
                          <p className="text-xs text-muted-foreground font-medium flex-shrink-0">
                            +{formatCurrency(option.price)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Quantity & Total */}
        <div className="bg-white rounded-lg p-4 space-y-4 sticky bottom-0">
          <div className="flex items-center gap-3 justify-between pb-4 border-b border-border">
            <span className="text-xs text-muted-foreground font-medium">Quantity:</span>
            <div className="flex items-center gap-2 border border-border rounded">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="p-1 hover:bg-muted text-muted-foreground"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="px-3 text-xs font-semibold">{quantity}</span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                className="p-1 hover:bg-muted text-muted-foreground"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Selected Items Summary */}
          {selectedAddonsDetails.length > 0 && (
            <div className="bg-muted/30 rounded-lg p-3 space-y-2 border border-border">
              <p className="text-xs font-semibold text-muted-foreground">Selected Add-ons:</p>
              <div className="space-y-1">
                {selectedAddonsDetails.map((addon) => (
                  <div key={addon.id} className="flex justify-between text-xs">
                    <span>
                      {addon.name}
                      {addon.count > 1 && <span className="text-muted-foreground ml-1">× {addon.count}</span>}
                    </span>
                    <span className="font-medium">{formatCurrency(addon.price * addon.count)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Price Breakdown */}
          <div className="space-y-2 bg-muted/20 rounded-lg p-3 border border-border">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Item:</span>
              <span className="font-medium">{formatCurrency(itemPrice)}</span>
            </div>
            {addonsPrice > 0 && (
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Add-ons Total:</span>
                <span className="font-medium">+{formatCurrency(addonsPrice)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs font-semibold border-t border-border pt-2">
              <span>Per Item:</span>
              <span>{formatCurrency(pricePerUnit)}</span>
            </div>
            {quantity > 1 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>× Quantity ({quantity})</span>
                <span>{formatCurrency(pricePerUnit)} × {quantity}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-sm pt-2 border-t border-border">
              <span>Total:</span>
              <span className="text-primary">{formatCurrency(totalPrice)}</span>
            </div>
          </div>

          <Button
            onClick={handleAddToCart}
            className="w-full h-9 bg-primary text-white hover:bg-primary-dark text-sm font-medium"
          >
            Add to Cart
          </Button>

          <Link href={`/${slug}`} className="w-full block">
            <Button variant="outline" className="w-full h-9 text-sm">
              Back to Menu
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
