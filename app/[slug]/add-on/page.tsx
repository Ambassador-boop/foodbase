'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  AlertCircle,
  Plus,
  Minus,
  ShoppingBag,
  ImageIcon,
  Check,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fetchColorConfig, DEFAULT_COLORS, type ColorConfig } from '@/lib/color-config';

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
  const { toast } = useToast();
  const slug = params.slug as string;
  const itemId = searchParams.get('itemId');
  const initialQty = Math.max(1, Number(searchParams.get('qty')) || 1);

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAddons, setSelectedAddons] = useState<
    Record<string, Array<{ id: string; quantity: number }>>
  >({});
  const [quantity, setQuantity] = useState(initialQty);
  const [colors, setColors] = useState<ColorConfig>(DEFAULT_COLORS);

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
      const response = await fetch(`/api/restaurants/${slug}/menu`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch menu');
      }

      setRestaurant(data.business);

      // Theme
      if (data.business?.id) {
        const c = await fetchColorConfig(data.business.id, 'menu');
        setColors(c);
      }

      // Find the selected item
      const item = data.menuItems?.find((m: MenuItem) => m.id === itemId);
      if (item) {
        setSelectedItem(item);
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
      const addonDetailsPromises = addonRefs.map(async (addon) => {
        const response = await fetch(`/api/public/addons/${addon.id}`);
        if (response.ok) {
          const data = await response.json();
          return {
            id: data.id,
            name: data.name,
            description: data.description,
            is_required: data.is_required,
            addon_type: data.addon_type,
            allow_multiple: data.allow_multiple,
            image_url: data.image_url,
            options: data.options || [],
          } as Addon;
        }
        return addon;
      });

      const addonDetails = await Promise.all(addonDetailsPromises);
      setAddons(addonDetails);
    } catch (err) {
      console.error('[v0] Error fetching addon details:', err);
      setAddons(addonRefs);
    }
  };

  /* ---------- Selection helpers (inline qty control) ---------- */

  const getOptionQty = (addonId: string, optionId: string) => {
    const list = selectedAddons[addonId] || [];
    const found = list.find((x) => x.id === optionId);
    return found?.quantity ?? 0;
  };

  const setOptionQty = (
    addonId: string,
    optionId: string,
    qty: number,
    addon: Addon,
  ) => {
    setSelectedAddons((prev) => {
      const current = prev[addonId] || [];

      // For non-multi addons (single-select), enforce one option at a time
      if (!addon.allow_multiple && qty > 0) {
        return {
          ...prev,
          [addonId]: [{ id: optionId, quantity: 1 }],
        };
      }

      // Remove if 0
      if (qty <= 0) {
        const next = current.filter((x) => x.id !== optionId);
        if (next.length === 0) {
          const { [addonId]: _omit, ...rest } = prev;
          return rest;
        }
        return { ...prev, [addonId]: next };
      }

      const idx = current.findIndex((x) => x.id === optionId);
      if (idx >= 0) {
        const next = [...current];
        next[idx] = { id: optionId, quantity: qty };
        return { ...prev, [addonId]: next };
      }
      return { ...prev, [addonId]: [...current, { id: optionId, quantity: qty }] };
    });
  };

  const incrementOption = (addon: Addon, option: AddonOption) => {
    const cur = getOptionQty(addon.id, option.id);
    if (!addon.allow_multiple && cur >= 1) return;
    setOptionQty(addon.id, option.id, cur + 1, addon);
  };

  const decrementOption = (addon: Addon, option: AddonOption) => {
    const cur = getOptionQty(addon.id, option.id);
    setOptionQty(addon.id, option.id, Math.max(0, cur - 1), addon);
  };

  /* ---------------------- Add to cart ---------------------- */

  const handleAddToCart = () => {
    // Validate required addons
    for (const addon of addons) {
      if (addon.is_required && !selectedAddons[addon.id]?.length) {
        toast({
          title: 'Selection required',
          description: `Please choose an option for "${addon.name}".`,
          variant: 'destructive',
        });
        return;
      }
    }

    if (!selectedItem) return;

    const storedCart = sessionStorage.getItem(`cart_${slug}`);
    let cartItems: any[] = [];
    try {
      cartItems = storedCart ? JSON.parse(storedCart) : [];
    } catch {
      cartItems = [];
    }

    // Build addons array — expand by quantity
    const addonsArray: any[] = [];
    addons.forEach((addon) => {
      const sel = selectedAddons[addon.id];
      if (!sel) return;
      sel.forEach((it) => {
        const option = addon.options?.find((o) => o.id === it.id);
        if (!option) return;
        for (let i = 0; i < it.quantity; i++) {
          addonsArray.push({
            id: option.id,
            name: option.name,
            price: Number(option.price) || 0,
            image_url: option.image_url,
          });
        }
      });
    });

    const addonsKey = addonsArray.map((a) => a.id).sort().join('-');
    const cartKey = `${selectedItem.id}_${addonsKey}`;

    const existingCartItem = cartItems.find((ci: any) => ci.cartKey === cartKey);
    if (existingCartItem) {
      const newItems = cartItems.map((ci: any) =>
        ci === existingCartItem ? { ...ci, quantity: ci.quantity + quantity } : ci,
      );
      sessionStorage.setItem(`cart_${slug}`, JSON.stringify(newItems));
    } else {
      cartItems.push({
        id: selectedItem.id,
        cartKey,
        type: 'menu',
        name: selectedItem.name,
        price: Number(selectedItem.price) || 0,
        image_url: selectedItem.image_url,
        quantity: Number(quantity),
        addons: addonsArray,
      });
      sessionStorage.setItem(`cart_${slug}`, JSON.stringify(cartItems));
    }

    toast({
      title: 'Added to cart',
      description: `${selectedItem.name} has been added to your cart`,
    });

    router.push(`/${slug}`);
  };

  /* ---------------------- Calculations ---------------------- */

  const itemPrice = Number(selectedItem?.price) || 0;

  // Flat list of selected options with their counts (for summary)
  const selectedAddonsDetails = useMemo(() => {
    const details: Array<{
      id: string;
      addonName: string;
      name: string;
      price: number;
      count: number;
    }> = [];

    addons.forEach((addon) => {
      const sel = selectedAddons[addon.id];
      if (!sel) return;
      sel.forEach((it) => {
        const opt = addon.options?.find((o) => o.id === it.id);
        if (!opt) return;
        details.push({
          id: opt.id,
          addonName: addon.name,
          name: opt.name,
          price: Number(opt.price) || 0,
          count: it.quantity,
        });
      });
    });

    return details;
  }, [addons, selectedAddons]);

  const addonsPricePerUnit = useMemo(
    () => selectedAddonsDetails.reduce((sum, d) => sum + d.price * d.count, 0),
    [selectedAddonsDetails],
  );
  const pricePerUnit = itemPrice + addonsPricePerUnit;
  const subtotalItem = itemPrice * quantity;
  const subtotalAddons = addonsPricePerUnit * quantity;
  const totalPrice = pricePerUnit * quantity;

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 2,
    }).format(amount);

  /* ---------------------- States ---------------------- */

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: colors.backgroundColor }}
      >
        <p style={{ color: colors.textColor, opacity: 0.7 }}>Loading add-ons…</p>
      </div>
    );
  }

  if (error || !selectedItem) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: colors.backgroundColor }}>
        <header
          className="sticky top-0 z-40 border-b"
          style={{
            backgroundColor: colors.headerColor,
            borderColor: `${colors.accentColor}1a`,
          }}
        >
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
            <Link
              href={`/${slug}`}
              className="p-2 rounded-full transition-colors"
              style={{ color: colors.headerTextColor }}
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-bold" style={{ color: colors.headerTextColor }}>
              Add-ons
            </h1>
          </div>
        </header>
        <div className="flex items-center justify-center p-6 mt-12">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 mx-auto mb-3" style={{ color: '#dc2626' }} />
            <p className="font-medium mb-4" style={{ color: colors.textColor }}>
              {error}
            </p>
            <Link href={`/${slug}`}>
              <Button variant="outline">Back to Menu</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ---------------------- Render ---------------------- */

  return (
    <div
      className="min-h-screen pb-[280px] sm:pb-[260px]"
      style={{ backgroundColor: colors.backgroundColor }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-40 border-b"
        style={{
          backgroundColor: colors.headerColor,
          borderColor: `${colors.accentColor}1a`,
        }}
      >
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href={`/${slug}/${itemId}`}
            className="p-2 rounded-full transition-colors hover:bg-black/5"
            style={{ color: colors.headerTextColor }}
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <p
              className="text-[11px] uppercase tracking-wider font-semibold"
              style={{ color: colors.headerTextColor, opacity: 0.6 }}
            >
              Customise
            </p>
            <h1
              className="text-base sm:text-lg font-bold leading-tight truncate"
              style={{ color: colors.headerTextColor }}
            >
              {selectedItem.name}
            </h1>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
        {/* Item summary */}
        <section
          className="rounded-2xl overflow-hidden border"
          style={{
            backgroundColor: colors.headerColor,
            borderColor: `${colors.accentColor}1f`,
          }}
        >
          <div className="flex items-stretch gap-4 p-3 sm:p-4">
            <div
              className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-xl overflow-hidden flex-shrink-0"
              style={{ backgroundColor: `${colors.accentColor}10` }}
            >
              {selectedItem.image_url ? (
                <Image
                  src={selectedItem.image_url}
                  alt={selectedItem.name}
                  fill
                  className="object-cover"
                  sizes="(min-width: 640px) 8rem, 6rem"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon
                    className="w-8 h-8"
                    style={{ color: colors.accentColor, opacity: 0.5 }}
                  />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col justify-between">
              <div>
                <h2
                  className="text-base sm:text-lg font-bold leading-tight text-balance"
                  style={{ color: colors.textColor }}
                >
                  {selectedItem.name}
                </h2>
                {selectedItem.description && (
                  <p
                    className="text-xs sm:text-sm mt-1 leading-relaxed line-clamp-2"
                    style={{ color: colors.textColor, opacity: 0.7 }}
                  >
                    {selectedItem.description}
                  </p>
                )}
              </div>
              <p
                className="text-sm sm:text-base font-bold mt-2"
                style={{ color: colors.accentColor }}
              >
                {formatCurrency(itemPrice)}
              </p>
            </div>
          </div>
        </section>

        {/* Add-on groups */}
        {addons.length === 0 ? (
          <div
            className="rounded-2xl p-8 text-center border"
            style={{
              backgroundColor: colors.headerColor,
              borderColor: `${colors.accentColor}1f`,
            }}
          >
            <p style={{ color: colors.textColor, opacity: 0.7 }}>
              No add-ons available for this item.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {addons.map((addon) => {
              const groupCount = (selectedAddons[addon.id] || []).reduce(
                (n, x) => n + x.quantity,
                0,
              );
              return (
                <section
                  key={addon.id}
                  className="rounded-2xl overflow-hidden border"
                  style={{
                    backgroundColor: colors.headerColor,
                    borderColor: `${colors.accentColor}1f`,
                  }}
                >
                  {/* Group header */}
                  <div
                    className="flex items-center justify-between px-4 py-3 border-b"
                    style={{ borderColor: `${colors.accentColor}14` }}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3
                          className="text-sm sm:text-base font-bold"
                          style={{ color: colors.textColor }}
                        >
                          {addon.name}
                        </h3>
                        {addon.is_required && (
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: '#fee2e2',
                              color: '#b91c1c',
                            }}
                          >
                            Required
                          </span>
                        )}
                        {!addon.allow_multiple && (
                          <span
                            className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{
                              backgroundColor: `${colors.accentColor}14`,
                              color: colors.accentColor,
                            }}
                          >
                            Pick one
                          </span>
                        )}
                      </div>
                      {addon.description && (
                        <p
                          className="text-xs mt-1 leading-relaxed"
                          style={{ color: colors.textColor, opacity: 0.65 }}
                        >
                          {addon.description}
                        </p>
                      )}
                    </div>
                    {groupCount > 0 && (
                      <div
                        className="flex items-center gap-1 text-xs font-semibold flex-shrink-0 ml-3"
                        style={{ color: colors.accentColor }}
                      >
                        <Check className="w-3.5 h-3.5" />
                        {groupCount}
                      </div>
                    )}
                  </div>

                  {/* Options grid */}
                  <div className="p-3 sm:p-4">
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                      {addon.options.map((option) => {
                        const qty = getOptionQty(addon.id, option.id);
                        const isSelected = qty > 0;
                        return (
                          <li key={option.id}>
                            <button
                              type="button"
                              onClick={() =>
                                isSelected && !addon.allow_multiple
                                  ? decrementOption(addon, option)
                                  : incrementOption(addon, option)
                              }
                              className="w-full flex items-center gap-3 p-2 sm:p-3 rounded-xl border transition-all text-left"
                              style={{
                                backgroundColor: isSelected
                                  ? `${colors.accentColor}10`
                                  : 'transparent',
                                borderColor: isSelected
                                  ? colors.accentColor
                                  : `${colors.accentColor}26`,
                              }}
                            >
                              {/* Image / placeholder */}
                              <div
                                className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden flex-shrink-0"
                                style={{ backgroundColor: `${colors.accentColor}14` }}
                              >
                                {option.image_url ? (
                                  <Image
                                    src={option.image_url}
                                    alt={option.name}
                                    fill
                                    className="object-cover"
                                    sizes="64px"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center">
                                    <ImageIcon
                                      className="w-5 h-5"
                                      style={{
                                        color: colors.accentColor,
                                        opacity: 0.5,
                                      }}
                                    />
                                  </div>
                                )}
                                {isSelected && (
                                  <div
                                    className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                                    style={{
                                      backgroundColor: colors.accentColor,
                                      color: colors.buttonTextColor,
                                    }}
                                  >
                                    <Check className="w-3 h-3" strokeWidth={3} />
                                  </div>
                                )}
                              </div>

                              {/* Text */}
                              <div className="flex-1 min-w-0">
                                <p
                                  className="text-sm font-semibold leading-tight"
                                  style={{ color: colors.textColor }}
                                >
                                  {option.name}
                                </p>
                                {Number(option.price) > 0 ? (
                                  <p
                                    className="text-xs font-medium mt-0.5"
                                    style={{
                                      color: colors.accentColor,
                                    }}
                                  >
                                    +{formatCurrency(Number(option.price))}
                                  </p>
                                ) : (
                                  <p
                                    className="text-xs mt-0.5"
                                    style={{
                                      color: colors.textColor,
                                      opacity: 0.55,
                                    }}
                                  >
                                    Free
                                  </p>
                                )}
                              </div>

                              {/* Qty controls */}
                              {isSelected && addon.allow_multiple ? (
                                <div
                                  className="flex items-center gap-1 rounded-full p-0.5 flex-shrink-0"
                                  style={{
                                    backgroundColor: colors.accentColor,
                                    color: colors.buttonTextColor,
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      decrementOption(addon, option);
                                    }}
                                    aria-label="Decrease"
                                    className="w-7 h-7 rounded-full flex items-center justify-center transition active:scale-95"
                                    style={{ color: colors.buttonTextColor }}
                                  >
                                    <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
                                  </button>
                                  <span className="text-xs font-bold min-w-[1ch] text-center px-1">
                                    {qty}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      incrementOption(addon, option);
                                    }}
                                    aria-label="Increase"
                                    className="w-7 h-7 rounded-full flex items-center justify-center transition active:scale-95"
                                    style={{ color: colors.buttonTextColor }}
                                  >
                                    <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                                  </button>
                                </div>
                              ) : (
                                <div
                                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border"
                                  style={{
                                    backgroundColor: isSelected
                                      ? colors.accentColor
                                      : 'transparent',
                                    borderColor: isSelected
                                      ? colors.accentColor
                                      : `${colors.accentColor}40`,
                                    color: isSelected
                                      ? colors.buttonTextColor
                                      : colors.accentColor,
                                  }}
                                >
                                  {isSelected ? (
                                    <Check className="w-4 h-4" strokeWidth={3} />
                                  ) : (
                                    <Plus className="w-4 h-4" strokeWidth={2.5} />
                                  )}
                                </div>
                              )}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky bottom: full price breakdown */}
      <div
        className="fixed left-0 right-0 bottom-0 z-40 border-t backdrop-blur"
        style={{
          backgroundColor: `${colors.headerColor}f2`,
          borderColor: `${colors.accentColor}1f`,
        }}
      >
        <div className="max-w-3xl mx-auto px-4 py-3 sm:py-4">
          {/* Top row: quantity stepper + total */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="flex items-center gap-1 rounded-full p-1 flex-shrink-0"
              style={{
                backgroundColor: `${colors.accentColor}14`,
              }}
            >
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-8 h-8 rounded-full flex items-center justify-center transition active:scale-95 disabled:opacity-40"
                style={{ color: colors.accentColor }}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
              >
                <Minus className="w-4 h-4" strokeWidth={2.5} />
              </button>
              <span
                className="text-sm font-bold min-w-[2ch] text-center px-1"
                style={{ color: colors.textColor }}
              >
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="w-8 h-8 rounded-full flex items-center justify-center transition active:scale-95"
                style={{ color: colors.accentColor }}
                aria-label="Increase quantity"
              >
                <Plus className="w-4 h-4" strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 text-right">
              <p
                className="text-[11px] uppercase tracking-wider font-semibold"
                style={{ color: colors.textColor, opacity: 0.6 }}
              >
                Total
              </p>
              <p
                className="text-xl sm:text-2xl font-extrabold leading-tight"
                style={{ color: colors.textColor }}
              >
                {formatCurrency(totalPrice)}
              </p>
            </div>
          </div>

          {/* Breakdown — collapsed compactly */}
          <details className="group" open={selectedAddonsDetails.length > 0}>
            <summary
              className="cursor-pointer list-none flex items-center justify-between text-xs font-semibold py-1.5 select-none"
              style={{ color: colors.accentColor }}
            >
              <span>
                Breakdown
                {selectedAddonsDetails.length > 0 && (
                  <span
                    className="ml-1 font-medium"
                    style={{ color: colors.textColor, opacity: 0.6 }}
                  >
                    ({selectedAddonsDetails.length} add-on
                    {selectedAddonsDetails.length === 1 ? '' : 's'})
                  </span>
                )}
              </span>
              <span className="transition-transform group-open:rotate-180">▾</span>
            </summary>

            <div
              className="mt-2 rounded-xl p-3 space-y-1.5 text-xs"
              style={{
                backgroundColor: `${colors.accentColor}0a`,
                color: colors.textColor,
              }}
            >
              {/* Base */}
              <div className="flex items-baseline justify-between gap-3">
                <span className="opacity-75 truncate">
                  {selectedItem.name}
                  <span className="opacity-60"> · {formatCurrency(itemPrice)} × {quantity}</span>
                </span>
                <span className="font-semibold whitespace-nowrap">
                  {formatCurrency(subtotalItem)}
                </span>
              </div>

              {/* Add-ons */}
              {selectedAddonsDetails.length > 0 && (
                <>
                  <div
                    className="h-px my-1"
                    style={{ backgroundColor: `${colors.accentColor}1f` }}
                  />
                  {selectedAddonsDetails.map((d) => {
                    const lineUnit = d.price * d.count; // per single base item
                    const lineTotal = lineUnit * quantity;
                    return (
                      <div
                        key={`${d.addonName}-${d.id}`}
                        className="flex items-baseline justify-between gap-3"
                      >
                        <span className="opacity-75 truncate">
                          {d.name}
                          {d.count > 1 && (
                            <span className="opacity-60"> × {d.count}</span>
                          )}
                          <span className="opacity-50"> · {formatCurrency(d.price)}</span>
                          {quantity > 1 && (
                            <span className="opacity-50"> × {quantity}</span>
                          )}
                        </span>
                        <span className="font-semibold whitespace-nowrap">
                          +{formatCurrency(lineTotal)}
                        </span>
                      </div>
                    );
                  })}
                  <div className="flex items-baseline justify-between gap-3 pt-1">
                    <span
                      className="font-semibold"
                      style={{ color: colors.textColor, opacity: 0.85 }}
                    >
                      Add-ons subtotal
                    </span>
                    <span className="font-semibold">
                      +{formatCurrency(subtotalAddons)}
                    </span>
                  </div>
                </>
              )}

              <div
                className="h-px my-1"
                style={{ backgroundColor: `${colors.accentColor}1f` }}
              />
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-bold">Total</span>
                <span className="font-extrabold">{formatCurrency(totalPrice)}</span>
              </div>
            </div>
          </details>

          <Button
            onClick={handleAddToCart}
            className="w-full h-12 rounded-full mt-3 font-bold text-sm sm:text-base shadow-md hover:opacity-95"
            style={{
              backgroundColor: colors.buttonColor,
              color: colors.buttonTextColor,
            }}
          >
            <ShoppingBag className="w-4 h-4 mr-2" />
            Add {quantity > 1 ? `${quantity} ` : ''}to cart · {formatCurrency(totalPrice)}
          </Button>
        </div>
      </div>
    </div>
  );
}
