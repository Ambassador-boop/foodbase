'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import {
  ShoppingCart,
  AlertCircle,
  Wine,
  X,
  Plus,
  ThumbsUp,
  UtensilsCrossed,
} from 'lucide-react';
import { AddonSelectionModal } from '@/components/addon-selection-modal';
import { useToast } from '@/hooks/use-toast';
import { fetchColorConfig, type ColorConfig, DEFAULT_COLORS } from '@/lib/color-config';

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  original_price?: number | null;
  discounted_price?: number | null;
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
  logo_url?: string;
  cover_image_url?: string;
}

interface Category {
  id: string;
  name: string;
  display_order: number;
}

export default function RestaurantPage() {
  const params = useParams();
  const router = useRouter();
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

  // Group menu items by category
  const groupedItems = categories
    .map((cat) => ({
      category: cat,
      items: menuItems.filter((item) => item.category_id === cat.id),
    }))
    .filter((group) => group.items.length > 0);

  // Determine "Most liked" ranking from order_count (top 3)
  const mostLikedRanking = (() => {
    const sorted = [...menuItems]
      .filter((m) => (m.order_count || 0) > 0)
      .sort((a, b) => (b.order_count || 0) - (a.order_count || 0))
      .slice(0, 3);
    const map = new Map<string, number>();
    sorted.forEach((item, idx) => map.set(item.id, idx + 1));
    return map;
  })();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: colors.backgroundColor }}
      >
        <p style={{ color: colors.textColor, opacity: 0.7 }}>Loading menu...</p>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4"
        style={{ backgroundColor: colors.backgroundColor }}
      >
        <div className="text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-red-500 mb-3" />
          <p className="font-medium mb-3" style={{ color: colors.textColor }}>
            {error}
          </p>
          <Link href="/">
            <Button variant="outline">Back to Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen pb-24"
      style={{ backgroundColor: colors.backgroundColor }}
    >
      {/* Hero / Cover section */}
      <RestaurantHero
        restaurant={restaurant}
        onClose={() => router.push('/')}
        accentColor={colors.accentColor}
        textColor={colors.textColor}
        cardBg={colors.headerColor}
      />

      {/* Sticky toolbar: cart + drinks toggle */}
      <div
        className="sticky top-0 z-40 border-b"
        style={{
          backgroundColor: colors.headerColor,
          borderColor: `${colors.accentColor}33`,
        }}
      >
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowDrinks(false)}
              className="text-sm font-semibold px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
              style={{
                backgroundColor: !showDrinks ? colors.buttonColor : 'transparent',
                color: !showDrinks ? colors.buttonTextColor : colors.headerTextColor,
                border: `1px solid ${colors.accentColor}`,
              }}
            >
              <UtensilsCrossed className="w-3.5 h-3.5" />
              Menu
            </button>
            {drinks.length > 0 && (
              <button
                onClick={() => setShowDrinks(true)}
                className="text-sm font-semibold px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
                style={{
                  backgroundColor: showDrinks ? colors.buttonColor : 'transparent',
                  color: showDrinks ? colors.buttonTextColor : colors.headerTextColor,
                  border: `1px solid ${colors.accentColor}`,
                }}
              >
                <Wine className="w-3.5 h-3.5" />
                Drinks
              </button>
            )}
          </div>
          <Link
            href={`/${slug}/cart`}
            className="relative p-2 rounded-full transition-colors"
            style={{ color: colors.buttonColor }}
            aria-label="View cart"
          >
            <ShoppingCart className="w-5 h-5" />
            {cartItems.length > 0 && (
              <span
                style={{
                  backgroundColor: colors.buttonColor,
                  color: colors.buttonTextColor,
                }}
                className="absolute -top-0.5 -right-0.5 text-[10px] font-bold rounded-full min-w-5 h-5 px-1 flex items-center justify-center"
              >
                {cartItems.length}
              </span>
            )}
          </Link>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-5">
        {showDrinks ? (
          <DrinksSection
            drinks={drinks}
            colors={colors}
            onAdd={handleDrinkAdd}
            formatCurrency={formatCurrency}
          />
        ) : (
          <MenuSection
            groupedItems={groupedItems}
            menuItems={menuItems}
            colors={colors}
            mostLikedRanking={mostLikedRanking}
            slug={slug}
            onAdd={addToCart}
            formatCurrency={formatCurrency}
          />
        )}
      </main>

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

      {/* Floating cart pill (bottom) */}
      {cartItems.length > 0 && (
        <Link
          href={`/${slug}/cart`}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-full shadow-lg flex items-center gap-2 font-semibold text-sm transition-transform hover:scale-105"
          style={{
            backgroundColor: colors.buttonColor,
            color: colors.buttonTextColor,
          }}
        >
          <ShoppingCart className="w-4 h-4" />
          <span>View cart</span>
          <span
            className="rounded-full min-w-6 h-6 px-1.5 text-xs flex items-center justify-center font-bold"
            style={{
              backgroundColor: colors.buttonTextColor,
              color: colors.buttonColor,
            }}
          >
            {cartItems.length}
          </span>
        </Link>
      )}
    </div>
  );
}

/* ---------- Subcomponents ---------- */

function RestaurantHero({
  restaurant,
  onClose,
  accentColor,
  textColor,
  cardBg,
}: {
  restaurant: Restaurant;
  onClose: () => void;
  accentColor: string;
  textColor: string;
  cardBg: string;
}) {
  return (
    <div className="relative">
      {/* Cover image */}
      <div className="relative w-full h-44 sm:h-56 md:h-64 overflow-hidden">
        {restaurant.cover_image_url ? (
          <Image
            src={restaurant.cover_image_url}
            alt={`${restaurant.name} cover`}
            fill
            priority
            className="object-cover"
            sizes="100vw"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{
              background: `linear-gradient(135deg, ${accentColor}cc, ${accentColor}66)`,
            }}
          />
        )}
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 left-3 w-10 h-10 rounded-full flex items-center justify-center shadow-md backdrop-blur-sm"
          style={{ backgroundColor: `${cardBg}e6`, color: textColor }}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Floating info card */}
      <div className="max-w-3xl mx-auto px-4 -mt-12 sm:-mt-14 relative z-10">
        <div
          className="rounded-2xl shadow-md pt-12 sm:pt-14 pb-5 px-5 text-center relative"
          style={{ backgroundColor: cardBg }}
        >
          {/* Logo */}
          <div
            className="absolute left-1/2 -translate-x-1/2 -top-10 sm:-top-12 w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-4 shadow-sm bg-white flex items-center justify-center"
            style={{ borderColor: cardBg }}
          >
            {restaurant.logo_url ? (
              <Image
                src={restaurant.logo_url}
                alt={`${restaurant.name} logo`}
                width={96}
                height={96}
                className="object-cover w-full h-full"
              />
            ) : (
              <span
                className="text-2xl font-bold"
                style={{ color: accentColor }}
              >
                {restaurant.name.charAt(0)}
              </span>
            )}
          </div>

          <h1
            className="text-2xl sm:text-3xl font-bold tracking-tight text-balance"
            style={{ color: textColor }}
          >
            {restaurant.name}
          </h1>

          {restaurant.description && (
            <div className="mt-3 inline-block">
              <span
                className="text-sm font-medium px-4 py-1.5 rounded-full"
                style={{
                  backgroundColor: `${accentColor}1a`,
                  color: accentColor,
                }}
              >
                {restaurant.description}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuSection({
  groupedItems,
  menuItems,
  colors,
  mostLikedRanking,
  slug,
  onAdd,
  formatCurrency,
}: {
  groupedItems: { category: Category; items: MenuItem[] }[];
  menuItems: MenuItem[];
  colors: ColorConfig;
  mostLikedRanking: Map<string, number>;
  slug: string;
  onAdd: (id: string) => void;
  formatCurrency: (n: number) => string;
}) {
  if (menuItems.length === 0) {
    return (
      <div
        className="rounded-2xl p-10 text-center"
        style={{ backgroundColor: colors.headerColor }}
      >
        <UtensilsCrossed
          className="w-10 h-10 mx-auto mb-3"
          style={{ color: colors.accentColor, opacity: 0.6 }}
        />
        <p className="text-sm" style={{ color: colors.textColor }}>
          No menu items available
        </p>
      </div>
    );
  }

  // Featured "Most liked" row (top items by order_count)
  const featured = [...menuItems]
    .filter((m) => (m.order_count || 0) > 0)
    .sort((a, b) => (b.order_count || 0) - (a.order_count || 0))
    .slice(0, 4);

  return (
    <div className="space-y-8">
      {featured.length >= 2 && (
        <section>
          <h2
            className="text-lg font-bold mb-3"
            style={{ color: colors.textColor }}
          >
            Most liked
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {featured.map((item) => (
              <FeaturedCard
                key={item.id}
                item={item}
                colors={colors}
                rank={mostLikedRanking.get(item.id)}
                slug={slug}
                onAdd={onAdd}
                formatCurrency={formatCurrency}
              />
            ))}
          </div>
        </section>
      )}

      {groupedItems.length > 0
        ? groupedItems.map((group) => (
            <section key={group.category.id}>
              <div
                className="sticky top-[57px] z-30 -mx-4 px-4 py-2 mb-3"
                style={{ backgroundColor: colors.backgroundColor }}
              >
                <h2
                  className="text-lg font-bold"
                  style={{ color: colors.textColor }}
                >
                  {group.category.name}
                </h2>
              </div>
              <div className="divide-y" style={{ borderColor: `${colors.accentColor}1a` }}>
                {group.items.map((item) => (
                  <MenuRow
                    key={item.id}
                    item={item}
                    colors={colors}
                    rank={mostLikedRanking.get(item.id)}
                    slug={slug}
                    onAdd={onAdd}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </div>
            </section>
          ))
        : (
          <section>
            <div className="divide-y" style={{ borderColor: `${colors.accentColor}1a` }}>
              {menuItems.map((item) => (
                <MenuRow
                  key={item.id}
                  item={item}
                  colors={colors}
                  rank={mostLikedRanking.get(item.id)}
                  slug={slug}
                  onAdd={onAdd}
                  formatCurrency={formatCurrency}
                />
              ))}
            </div>
          </section>
        )}
    </div>
  );
}

function MenuRow({
  item,
  colors,
  rank,
  slug,
  onAdd,
  formatCurrency,
}: {
  item: MenuItem;
  colors: ColorConfig;
  rank?: number;
  slug: string;
  onAdd: (id: string) => void;
  formatCurrency: (n: number) => string;
}) {
  const hasAddons = item.addons && item.addons.length > 0;
  const hasDiscount = item.discount_type && item.original_price;

  const handleClick = () => {
    if (hasAddons) {
      window.location.href = `/${slug}/add-on?itemId=${item.id}`;
    } else {
      onAdd(item.id);
    }
  };

  return (
    <article className="py-4 flex gap-4 items-start">
      {/* Left: text */}
      <div className="flex-1 min-w-0">
        <h3
          className="text-base sm:text-lg font-bold leading-snug text-pretty"
          style={{ color: colors.textColor }}
        >
          {item.name}
        </h3>
        {item.description && (
          <p
            className="mt-1 text-sm leading-relaxed line-clamp-2"
            style={{ color: colors.textColor, opacity: 0.7 }}
          >
            {item.description}
          </p>
        )}

        {/* Price + popularity */}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {hasDiscount ? (
            <>
              <span
                className="text-sm line-through"
                style={{ color: colors.textColor, opacity: 0.5 }}
              >
                {formatCurrency(Number(item.original_price))}
              </span>
              <span
                className="text-base font-bold"
                style={{ color: colors.accentColor }}
              >
                {formatCurrency(Number(item.price))}
              </span>
            </>
          ) : (
            <span
              className="text-base font-bold"
              style={{ color: colors.textColor }}
            >
              {formatCurrency(Number(item.price))}
            </span>
          )}

          {(item.order_count || 0) > 0 && (
            <span
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: colors.textColor, opacity: 0.7 }}
            >
              <span aria-hidden="true">·</span>
              <ThumbsUp
                className="w-3.5 h-3.5"
                style={{ color: colors.accentColor }}
              />
              <span>({item.order_count})</span>
            </span>
          )}
        </div>

        {rank && (
          <div className="mt-2">
            <span
              className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: `${colors.accentColor}1a`,
                color: colors.accentColor,
              }}
            >
              {`#${rank} Most liked`}
            </span>
          </div>
        )}
      </div>

      {/* Right: image with + button */}
      <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0">
        {item.image_url ? (
          <div className="relative w-full h-full rounded-xl overflow-hidden">
            <Image
              src={item.image_url}
              alt={item.name}
              fill
              className="object-cover"
              sizes="128px"
            />
            {item.discount_type && item.discount_value ? (
              <div className="absolute top-1.5 left-1.5 bg-red-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                {item.discount_type === 'percentage'
                  ? `${item.discount_value}% OFF`
                  : `-${formatCurrency(Number(item.discount_value))}`}
              </div>
            ) : null}
          </div>
        ) : (
          <div
            className="w-full h-full rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${colors.accentColor}1a` }}
          >
            <UtensilsCrossed
              className="w-8 h-8"
              style={{ color: colors.accentColor, opacity: 0.6 }}
            />
          </div>
        )}
        <button
          onClick={handleClick}
          aria-label={`Add ${item.name} to cart`}
          className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-transform active:scale-95"
          style={{
            backgroundColor: colors.buttonColor,
            color: colors.buttonTextColor,
          }}
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
        </button>
      </div>
    </article>
  );
}

function FeaturedCard({
  item,
  colors,
  rank,
  slug,
  onAdd,
  formatCurrency,
}: {
  item: MenuItem;
  colors: ColorConfig;
  rank?: number;
  slug: string;
  onAdd: (id: string) => void;
  formatCurrency: (n: number) => string;
}) {
  const hasAddons = item.addons && item.addons.length > 0;
  const hasDiscount = item.discount_type && item.original_price;

  const handleClick = () => {
    if (hasAddons) {
      window.location.href = `/${slug}/add-on?itemId=${item.id}`;
    } else {
      onAdd(item.id);
    }
  };

  return (
    <article className="flex flex-col">
      <div className="relative w-full aspect-square rounded-xl overflow-hidden">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 200px"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ backgroundColor: `${colors.accentColor}1a` }}
          >
            <UtensilsCrossed
              className="w-10 h-10"
              style={{ color: colors.accentColor, opacity: 0.6 }}
            />
          </div>
        )}
        {item.discount_type && item.discount_value ? (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-1 rounded text-[10px] font-bold">
            {item.discount_type === 'percentage'
              ? `${item.discount_value}% OFF`
              : `-${formatCurrency(Number(item.discount_value))}`}
          </div>
        ) : null}
        <button
          onClick={handleClick}
          aria-label={`Add ${item.name} to cart`}
          className="absolute top-2 right-2 w-9 h-9 rounded-lg flex items-center justify-center shadow-md transition-transform active:scale-95"
          style={{
            backgroundColor: colors.buttonColor,
            color: colors.buttonTextColor,
          }}
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
        </button>
      </div>

      <div className="pt-3">
        <h3
          className="text-base font-bold line-clamp-1 text-pretty"
          style={{ color: colors.textColor }}
        >
          {item.name}
        </h3>
        {item.description && (
          <p
            className="mt-1 text-sm line-clamp-2 leading-relaxed"
            style={{ color: colors.textColor, opacity: 0.7 }}
          >
            {item.description}
          </p>
        )}

        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {hasDiscount ? (
            <>
              <span
                className="text-xs line-through"
                style={{ color: colors.textColor, opacity: 0.5 }}
              >
                {formatCurrency(Number(item.original_price))}
              </span>
              <span
                className="text-sm font-bold"
                style={{ color: colors.accentColor }}
              >
                {formatCurrency(Number(item.price))}
              </span>
            </>
          ) : (
            <span
              className="text-sm font-bold"
              style={{ color: colors.textColor }}
            >
              {formatCurrency(Number(item.price))}
            </span>
          )}

          {(item.order_count || 0) > 0 && (
            <span
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: colors.textColor, opacity: 0.7 }}
            >
              <span aria-hidden="true">·</span>
              <ThumbsUp
                className="w-3.5 h-3.5"
                style={{ color: colors.accentColor }}
              />
              <span>({item.order_count})</span>
            </span>
          )}
        </div>

        {rank && (
          <div className="mt-2">
            <span
              className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                backgroundColor: `${colors.accentColor}1a`,
                color: colors.accentColor,
              }}
            >
              {`#${rank} Most liked`}
            </span>
          </div>
        )}
      </div>
    </article>
  );
}

function DrinksSection({
  drinks,
  colors,
  onAdd,
  formatCurrency,
}: {
  drinks: Drink[];
  colors: ColorConfig;
  onAdd: (id: string) => void;
  formatCurrency: (n: number) => string;
}) {
  if (drinks.length === 0) {
    return (
      <div
        className="rounded-2xl p-10 text-center"
        style={{ backgroundColor: colors.headerColor }}
      >
        <Wine
          className="w-10 h-10 mx-auto mb-3"
          style={{ color: colors.accentColor, opacity: 0.6 }}
        />
        <p className="text-sm" style={{ color: colors.textColor }}>
          No drinks available
        </p>
      </div>
    );
  }

  return (
    <section>
      <h2
        className="text-lg font-bold mb-3"
        style={{ color: colors.textColor }}
      >
        Drinks
      </h2>
      <div className="divide-y" style={{ borderColor: `${colors.accentColor}1a` }}>
        {drinks.map((drink) => (
          <article key={drink.id} className="py-4 flex gap-4 items-start">
            <div className="flex-1 min-w-0">
              <h3
                className="text-base sm:text-lg font-bold leading-snug text-pretty"
                style={{ color: colors.textColor }}
              >
                {drink.name}
              </h3>
              {drink.description && (
                <p
                  className="mt-1 text-sm leading-relaxed line-clamp-2"
                  style={{ color: colors.textColor, opacity: 0.7 }}
                >
                  {drink.description}
                </p>
              )}
              <div className="mt-2">
                <span
                  className="text-base font-bold"
                  style={{ color: colors.textColor }}
                >
                  {formatCurrency(Number(drink.price))}
                </span>
              </div>
            </div>

            <div className="relative w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0">
              {drink.image_url ? (
                <div className="relative w-full h-full rounded-xl overflow-hidden">
                  <Image
                    src={drink.image_url}
                    alt={drink.name}
                    fill
                    className="object-cover"
                    sizes="128px"
                  />
                </div>
              ) : (
                <div
                  className="w-full h-full rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${colors.accentColor}1a` }}
                >
                  <Wine
                    className="w-8 h-8"
                    style={{ color: colors.accentColor, opacity: 0.6 }}
                  />
                </div>
              )}
              <button
                onClick={() => onAdd(drink.id)}
                aria-label={`Add ${drink.name} to cart`}
                className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-transform active:scale-95"
                style={{
                  backgroundColor: colors.buttonColor,
                  color: colors.buttonTextColor,
                }}
              >
                <Plus className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
