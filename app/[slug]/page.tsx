'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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
  Info,
  MapPin,
  Phone,
  Clock,
  ChevronRight,
  ChevronLeft,
  Flame,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { fetchColorConfig, type ColorConfig, DEFAULT_COLORS } from '@/lib/color-config';
import { StorefrontFooter } from '@/components/storefront/storefront-footer';
import { CookingLoader } from '@/components/storefront/cooking-loader';

/* ------------------------------- Types ------------------------------- */

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
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  availability?: any | null;
  // Batch 3A: open/closed information rendered from opening hours.
  hours?: {
    isOpenNow: boolean;
    today: string;
    acceptOrdersOutsideHours: boolean;
  } | null;
  accept_orders_outside_hours?: boolean;
}

interface Category {
  id: string;
  name: string;
  display_order: number;
}

/* ------------------------------- Page ------------------------------- */

export default function RestaurantPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const { toast } = useToast();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [drinks, setDrinks] = useState<Drink[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [featured, setFeatured] = useState<MenuItem[]>([]);
  const [hotPicks, setHotPicks] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cartItems, setCartItems] = useState<any[]>([]);
  const [showDrinks, setShowDrinks] = useState(false);
  const [colors, setColors] = useState<ColorConfig>(DEFAULT_COLORS);
  const [showInfo, setShowInfo] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());

  /* ----------------------- Data fetching ----------------------- */

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
      const response = await fetch(`/api/restaurants/${slug}/menu`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch menu');

      setRestaurant(data.business);
      setMenuItems(data.menuItems || []);
      setDrinks(data.drinks || []);
      setCategories(data.categories || []);
      setFeatured(data.featured || []);
      setHotPicks(data.hotPicks || []);

      if (data.business?.id) {
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

  /* ----------------------- Active category tracking ----------------------- */

  useEffect(() => {
    if (categories.length === 0 || showDrinks) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) {
          const id = (visible[0].target as HTMLElement).dataset.categoryId;
          if (id) setActiveCategoryId(id);
        }
      },
      { rootMargin: '-120px 0px -55% 0px', threshold: [0.05, 0.25, 0.5] },
    );
    sectionRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [categories, showDrinks, menuItems]);

  const registerSectionRef = (id: string, el: HTMLElement | null) => {
    if (!el) {
      sectionRefs.current.delete(id);
      return;
    }
    sectionRefs.current.set(id, el);
  };

  const scrollToCategory = (id: string) => {
    const el = sectionRefs.current.get(id);
    if (!el) return;
    const yOffset = -110;
    const y = el.getBoundingClientRect().top + window.scrollY + yOffset;
    window.scrollTo({ top: y, behavior: 'smooth' });
    setSidebarOpen(false);
  };

  /* ----------------------- Cart helpers ----------------------- */

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
    if (!item) return;
    const existing = cartItems.find(
      (ci) =>
        ci.id === itemId &&
        ci.type === 'menu' &&
        (!ci.addons || ci.addons.length === 0),
    );
    if (existing) {
      setCartItems(
        cartItems.map((ci) =>
          ci === existing ? { ...ci, quantity: ci.quantity + 1 } : ci,
        ),
      );
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
  };

  const addDrinkToCart = (drink: Drink) => {
    const existing = cartItems.find(
      (ci) => ci.id === `drink_${drink.id}` && ci.type === 'drink',
    );
    if (existing) {
      setCartItems(
        cartItems.map((ci) =>
          ci === existing ? { ...ci, quantity: ci.quantity + 1 } : ci,
        ),
      );
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

  /* ----------------------- Derived data ----------------------- */

  const hotPickIds = useMemo(
    () => new Set(hotPicks.map((h) => h.id)),
    [hotPicks],
  );

  // Group items by category, putting hot picks first inside each category.
  const groupedItems = useMemo(
    () =>
      categories
        .map((cat) => {
          const items = menuItems.filter((m) => m.category_id === cat.id);
          const hot = items.filter((m) => hotPickIds.has(m.id));
          const rest = items.filter((m) => !hotPickIds.has(m.id));
          return { category: cat, items: [...hot, ...rest] };
        })
        .filter((g) => g.items.length > 0),
    [categories, menuItems, hotPickIds],
  );

  // Most liked: top 6 by order_count
  const mostLiked = useMemo(
    () =>
      [...menuItems]
        .filter((m) => (m.order_count || 0) > 0)
        .sort((a, b) => (b.order_count || 0) - (a.order_count || 0))
        .slice(0, 6),
    [menuItems],
  );
  const mostLikedRanking = useMemo(() => {
    const map = new Map<string, number>();
    mostLiked.forEach((item, idx) => map.set(item.id, idx + 1));
    return map;
  }, [mostLiked]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);

  /* ----------------------- Loading / error ----------------------- */

  if (loading) {
    return <CookingLoader colors={colors} />;
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

  /* ----------------------- Render ----------------------- */

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: colors.backgroundColor }}
    >
      {/* Hero */}
      <RestaurantHero
        restaurant={restaurant}
        onClose={() => router.push('/')}
        accentColor={colors.accentColor}
        textColor={colors.textColor}
        cardBg={colors.headerColor}
        onInfo={() => setShowInfo(true)}
      />

      {/* Sticky toolbar */}
      <div
        className="sticky top-0 z-40 border-b"
        style={{
          backgroundColor: colors.headerColor,
          borderColor: `${colors.accentColor}33`,
        }}
      >
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
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

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowInfo(true)}
              className="p-2 rounded-full transition-colors"
              style={{ color: colors.buttonColor }}
              aria-label="Restaurant info"
            >
              <Info className="w-5 h-5" />
            </button>
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
      </div>

      {/* Body — desktop sidebar + main */}
      <div className="max-w-6xl mx-auto md:flex md:items-start md:gap-6 md:px-4 md:pt-5">
        {/* Desktop sidebar */}
        {!showDrinks && groupedItems.length > 0 && (
          <DesktopCategorySidebar
            open={sidebarOpen}
            onToggle={() => setSidebarOpen((o) => !o)}
            categories={groupedItems.map((g) => g.category)}
            activeId={activeCategoryId}
            onSelect={scrollToCategory}
            colors={colors}
          />
        )}

        <main className="flex-1 min-w-0 px-4 py-5 md:px-0 pb-28 md:pb-8">
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
              featured={featured}
              hotPicks={hotPicks}
              hotPickIds={hotPickIds}
              colors={colors}
              mostLiked={mostLiked}
              mostLikedRanking={mostLikedRanking}
              slug={slug}
              onAdd={addToCart}
              formatCurrency={formatCurrency}
              registerSectionRef={registerSectionRef}
            />
          )}
        </main>
      </div>

      {/* Full-width Footer */}
      <StorefrontFooter colors={colors} inContentColumn={false} />

      {/* Floating cart pill */}
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

      {/* Info panel */}
      {showInfo && (
        <RestaurantInfoPanel
          restaurant={restaurant}
          colors={colors}
          onClose={() => setShowInfo(false)}
        />
      )}
    </div>
  );
}

/* ============================ Hero ============================ */

function RestaurantHero({
  restaurant,
  onClose,
  accentColor,
  textColor,
  cardBg,
  onInfo,
}: {
  restaurant: Restaurant;
  onClose: () => void;
  accentColor: string;
  textColor: string;
  cardBg: string;
  onInfo: () => void;
}) {
  return (
    <div className="relative">
      {/* Cover — capped on desktop so it never looks stretched */}
      <div className="relative w-full h-44 sm:h-56 md:h-72 lg:h-80 overflow-hidden">
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
        <div
          className="absolute inset-0 pointer-events-none md:bg-gradient-to-t md:from-black/40 md:via-transparent md:to-transparent"
          aria-hidden="true"
        />

        {/* Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 left-3 w-10 h-10 rounded-full flex items-center justify-center shadow-md backdrop-blur-sm"
          style={{ backgroundColor: `${cardBg}e6`, color: textColor }}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Desktop info button */}
        <button
          onClick={onInfo}
          aria-label="Restaurant info"
          className="hidden md:flex absolute top-3 right-3 w-10 h-10 rounded-full items-center justify-center shadow-md backdrop-blur-sm"
          style={{ backgroundColor: `${cardBg}e6`, color: accentColor }}
        >
          <Info className="w-5 h-5" />
        </button>

        {/* Desktop logo + title overlay */}
        <div className="hidden md:block absolute bottom-0 inset-x-0">
          <div className="max-w-6xl mx-auto px-6 pb-5 flex items-end gap-4">
            <div
              className="w-24 h-24 lg:w-28 lg:h-28 rounded-2xl overflow-hidden border-4 shadow-lg bg-white flex items-center justify-center flex-shrink-0"
              style={{ borderColor: cardBg }}
            >
              {restaurant.logo_url ? (
                <Image
                  src={restaurant.logo_url}
                  alt={`${restaurant.name} logo`}
                  width={112}
                  height={112}
                  className="object-cover w-full h-full"
                />
              ) : (
                <span
                  className="text-3xl font-bold"
                  style={{ color: accentColor }}
                >
                  {restaurant.name.charAt(0)}
                </span>
              )}
            </div>
            <div className="min-w-0 pb-1">
              <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-white text-balance drop-shadow-md">
                {restaurant.name}
              </h1>
              {restaurant.description && (
                <p className="mt-1 text-sm lg:text-base text-white/90 line-clamp-1 drop-shadow">
                  {restaurant.description}
                </p>
              )}
              <OpenStatus hours={restaurant.hours} accentColor={accentColor} />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile floating info card — unchanged from existing mobile UI */}
      <div className="md:hidden max-w-3xl mx-auto px-4 -mt-12 sm:-mt-14 relative z-10">
        <div
          className="rounded-2xl shadow-md pt-12 sm:pt-14 pb-5 px-5 text-center relative"
          style={{ backgroundColor: cardBg }}
        >
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

          {restaurant.hours && (
            <div className="mt-3 flex justify-center">
              <OpenStatus hours={restaurant.hours} accentColor={accentColor} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================ Open status ============================ */

/**
 * Open/closed badge for the storefront hero.
 *
 * Deliberately solid (no blur, no gradient) so it stays legible on any cover
 * photo. When the restaurant has not set hours yet it renders nothing rather
 * than guessing.
 */
function OpenStatus({
  hours,
  accentColor,
}: {
  hours: Restaurant['hours'];
  accentColor: string;
}) {
  if (!hours) return null;
  const open = hours.isOpenNow;
  return (
    <span
      className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11.5px] font-semibold shadow-sm"
      style={{ color: '#1D1A17' }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: open ? '#1F7A47' : '#8B7D71' }}
        aria-hidden="true"
      />
      {open ? 'Open now' : 'Closed now'}
      <span className="font-normal" style={{ color: '#6B5D52' }}>
        &middot; {hours.today}
      </span>
      {!open && hours.acceptOrdersOutsideHours === false ? (
        <span className="font-normal" style={{ color: accentColor }}>
          &middot; orders paused
        </span>
      ) : null}
    </span>
  );
}

/* ============================ Info panel ============================ */

function RestaurantInfoPanel({
  restaurant,
  colors,
  onClose,
}: {
  restaurant: Restaurant;
  colors: ColorConfig;
  onClose: () => void;
}) {
  const fullAddress = [
    restaurant.address,
    restaurant.city,
    restaurant.state,
    restaurant.country,
  ]
    .filter(Boolean)
    .join(', ');

  const availability =
    restaurant.availability && typeof restaurant.availability === 'object'
      ? restaurant.availability
      : null;

  const dayKeys: Array<{ key: string; label: string }> = [
    { key: 'mon', label: 'Monday' },
    { key: 'tue', label: 'Tuesday' },
    { key: 'wed', label: 'Wednesday' },
    { key: 'thu', label: 'Thursday' },
    { key: 'fri', label: 'Friday' },
    { key: 'sat', label: 'Saturday' },
    { key: 'sun', label: 'Sunday' },
  ];

  const schedule =
    availability && availability.schedule && typeof availability.schedule === 'object'
      ? availability.schedule
      : null;

  return (
    <>
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close info"
        onClick={onClose}
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] md:bg-black/30 animate-in fade-in"
      />

      {/* Panel — full screen on mobile, side card on desktop */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Restaurant information"
        className="fixed z-[51] inset-0 md:inset-auto md:top-4 md:right-4 md:w-96 md:max-h-[calc(100vh-2rem)] md:rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right-2"
        style={{ backgroundColor: colors.backgroundColor }}
      >
        <header
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{
            backgroundColor: colors.headerColor,
            borderColor: `${colors.accentColor}1f`,
          }}
        >
          <div>
            <p
              className="text-[11px] uppercase tracking-wider font-semibold"
              style={{ color: colors.accentColor }}
            >
              About this restaurant
            </p>
            <h2
              className="text-lg font-bold leading-tight"
              style={{ color: colors.textColor }}
            >
              {restaurant.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: `${colors.accentColor}14`,
              color: colors.textColor,
            }}
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Address */}
          <section>
            <div
              className="flex items-center gap-2 mb-2 text-xs uppercase tracking-wider font-semibold"
              style={{ color: colors.accentColor }}
            >
              <MapPin className="w-3.5 h-3.5" />
              Address
            </div>
            {fullAddress ? (
              <p
                className="text-sm leading-relaxed"
                style={{ color: colors.textColor }}
              >
                {fullAddress}
              </p>
            ) : (
              <p
                className="text-sm italic"
                style={{ color: colors.textColor, opacity: 0.55 }}
              >
                Address not provided yet.
              </p>
            )}
          </section>

          {/* Availability */}
          <section>
            <div
              className="flex items-center gap-2 mb-2 text-xs uppercase tracking-wider font-semibold"
              style={{ color: colors.accentColor }}
            >
              <Clock className="w-3.5 h-3.5" />
              Availability
            </div>
            {schedule ? (
              <ul className="space-y-1">
                {dayKeys.map(({ key, label }) => {
                  const day = schedule[key];
                  const closed = !day || day.closed === true;
                  return (
                    <li
                      key={key}
                      className="flex items-center justify-between text-sm py-1"
                      style={{ color: colors.textColor }}
                    >
                      <span className="font-medium">{label}</span>
                      <span style={{ opacity: 0.75 }}>
                        {closed ? 'Closed' : `${day.open} – ${day.close}`}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p
                className="text-sm italic"
                style={{ color: colors.textColor, opacity: 0.55 }}
              >
                The restaurant has not set its availability yet.
              </p>
            )}
            {availability?.note && (
              <p
                className="mt-2 text-xs leading-relaxed"
                style={{ color: colors.textColor, opacity: 0.7 }}
              >
                {availability.note}
              </p>
            )}
          </section>

          {/* Phone */}
          <section>
            <div
              className="flex items-center gap-2 mb-2 text-xs uppercase tracking-wider font-semibold"
              style={{ color: colors.accentColor }}
            >
              <Phone className="w-3.5 h-3.5" />
              Phone
            </div>
            {restaurant.phone ? (
              <a
                href={`tel:${restaurant.phone}`}
                className="text-sm font-semibold underline-offset-4 hover:underline"
                style={{ color: colors.textColor }}
              >
                {restaurant.phone}
              </a>
            ) : (
              <p
                className="text-sm italic"
                style={{ color: colors.textColor, opacity: 0.55 }}
              >
                Phone number not provided.
              </p>
            )}
          </section>
        </div>
      </aside>
    </>
  );
}

/* ============================ Sidebar ============================ */

function DesktopCategorySidebar({
  open,
  onToggle,
  categories,
  activeId,
  onSelect,
  colors,
}: {
  open: boolean;
  onToggle: () => void;
  categories: Category[];
  activeId: string | null;
  onSelect: (id: string) => void;
  colors: ColorConfig;
}) {
  return (
    <aside
      className="hidden md:block flex-shrink-0 sticky top-[64px] self-start"
      style={{ width: open ? 240 : 56, transition: 'width 200ms ease' }}
    >
      <div
        className="rounded-2xl border overflow-hidden"
        style={{
          backgroundColor: colors.headerColor,
          borderColor: `${colors.accentColor}1f`,
        }}
      >
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between px-3 py-3 border-b"
          style={{
            color: colors.textColor,
            borderColor: `${colors.accentColor}14`,
          }}
          aria-label={open ? 'Collapse categories' : 'Expand categories'}
        >
          {open ? (
            <>
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: colors.accentColor }}
              >
                Categories
              </span>
              <PanelLeftClose className="w-4 h-4" />
            </>
          ) : (
            <PanelLeftOpen className="w-4 h-4 mx-auto" />
          )}
        </button>

        <ul
          className="max-h-[60vh] overflow-y-auto py-1"
          style={{ scrollbarWidth: 'thin' }}
        >
          {categories.map((cat) => {
            const active = cat.id === activeId;
            return (
              <li key={cat.id}>
                <button
                  onClick={() => onSelect(cat.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left transition-colors"
                  style={{
                    backgroundColor: active
                      ? `${colors.accentColor}14`
                      : 'transparent',
                    color: active ? colors.accentColor : colors.textColor,
                  }}
                  title={cat.name}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: active
                        ? colors.accentColor
                        : `${colors.accentColor}40`,
                    }}
                  />
                  {open && (
                    <span
                      className={`text-sm truncate ${active ? 'font-semibold' : 'font-medium'
                        }`}
                    >
                      {cat.name}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

/* ============================ Menu Section ============================ */

function MenuSection({
  groupedItems,
  menuItems,
  featured,
  hotPicks,
  hotPickIds,
  colors,
  mostLiked,
  mostLikedRanking,
  slug,
  onAdd,
  formatCurrency,
  registerSectionRef,
}: {
  groupedItems: { category: Category; items: MenuItem[] }[];
  menuItems: MenuItem[];
  featured: MenuItem[];
  hotPicks: MenuItem[];
  hotPickIds: Set<string>;
  colors: ColorConfig;
  mostLiked: MenuItem[];
  mostLikedRanking: Map<string, number>;
  slug: string;
  onAdd: (id: string) => void;
  formatCurrency: (n: number) => string;
  registerSectionRef: (id: string, el: HTMLElement | null) => void;
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

  return (
    <div className="space-y-10">
      {/* Featured */}
      {featured.length > 0 && (
        <FeaturedScroller
          title="Featured"
          items={featured}
          colors={colors}
          slug={slug}
          onAdd={onAdd}
          formatCurrency={formatCurrency}
        />
      )}

      {/* Most liked — up to 6 with rank chips */}
      {mostLiked.length >= 2 && (
        <section>
          <SectionHeader title="Most liked" colors={colors} />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
            {mostLiked.map((item) => (
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

      {/* Categories with interleaved hot picks */}
      {groupedItems.map((group, idx) => {
        const hotSlice =
          hotPicks.length > 0
            ? hotPicks.slice(
              (idx * 2) % hotPicks.length,
              ((idx * 2) % hotPicks.length) + 2,
            )
            : [];
        // If wrap-around needed, fill the gap.
        if (hotPicks.length > 0 && hotSlice.length < 2) {
          const need = 2 - hotSlice.length;
          hotSlice.push(...hotPicks.slice(0, need));
        }

        return (
          <div key={group.category.id} className="space-y-6">
            <section
              data-category-id={group.category.id}
              ref={(el) => registerSectionRef(group.category.id, el)}
            >
              <div
                className="sticky top-[57px] z-30 -mx-4 px-4 py-2 mb-3 md:mx-0 md:px-0"
                style={{ backgroundColor: colors.backgroundColor }}
              >
                <h2
                  className="text-lg md:text-xl font-bold tracking-tight"
                  style={{ color: colors.textColor }}
                >
                  {group.category.name}
                </h2>
              </div>
              <div
                className="md:grid md:grid-cols-2 md:gap-x-6 md:gap-y-2 divide-y md:divide-y-0"
                style={{ borderColor: `${colors.accentColor}1a` }}
              >
                {group.items.map((item) => (
                  <MenuRow
                    key={item.id}
                    item={item}
                    colors={colors}
                    rank={mostLikedRanking.get(item.id)}
                    isHot={hotPickIds.has(item.id)}
                    slug={slug}
                    onAdd={onAdd}
                    formatCurrency={formatCurrency}
                  />
                ))}
              </div>
            </section>

            {/* Hot picks interleaved — mobile only */}
            {hotSlice.length > 0 && (
              <HotPicksInterstitial
                items={hotSlice}
                colors={colors}
                slug={slug}
                onAdd={onAdd}
                formatCurrency={formatCurrency}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function SectionHeader({
  title,
  colors,
}: {
  title: string;
  colors: ColorConfig;
}) {
  return (
    <div className="flex items-end justify-between mb-3">
      <h2
        className="text-lg md:text-xl font-bold tracking-tight"
        style={{ color: colors.textColor }}
      >
        {title}
      </h2>
    </div>
  );
}

/* ============================ Featured scroller ============================ */

function FeaturedScroller({
  title,
  items,
  colors,
  slug,
  onAdd,
  formatCurrency,
}: {
  title: string;
  items: MenuItem[];
  colors: ColorConfig;
  slug: string;
  onAdd: (id: string) => void;
  formatCurrency: (n: number) => string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 'left' | 'right') => {
    const el = ref.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <section>
      <div className="flex items-end justify-between mb-3">
        <h2
          className="text-lg md:text-xl font-bold tracking-tight"
          style={{ color: colors.textColor }}
        >
          {title}
        </h2>
        <div className="hidden md:flex items-center gap-2">
          <button
            aria-label="Scroll left"
            onClick={() => scroll('left')}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: `${colors.accentColor}14`,
              color: colors.textColor,
            }}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            aria-label="Scroll right"
            onClick={() => scroll('right')}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: `${colors.accentColor}14`,
              color: colors.textColor,
            }}
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div
        ref={ref}
        className="flex gap-3 md:gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 md:mx-0 md:px-0 scroll-smooth [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {items.map((item) => (
          <FeaturedScrollerCard
            key={item.id}
            item={item}
            colors={colors}
            slug={slug}
            onAdd={onAdd}
            formatCurrency={formatCurrency}
          />
        ))}
      </div>
    </section>
  );
}

function FeaturedScrollerCard({
  item,
  colors,
  slug,
  onAdd,
  formatCurrency,
}: {
  item: MenuItem;
  colors: ColorConfig;
  slug: string;
  onAdd: (id: string) => void;
  formatCurrency: (n: number) => string;
}) {
  const hasAddons = item.addons && item.addons.length > 0;
  const hasDiscount = item.discount_type && item.original_price;
  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasAddons) {
      window.location.href = `/${slug}/add-on?itemId=${item.id}`;
    } else {
      onAdd(item.id);
    }
  };

  return (
    <Link
      href={`/${slug}/${item.id}`}
      className="snap-start flex-shrink-0 w-44 md:w-56 rounded-2xl overflow-hidden border transition-transform hover:-translate-y-0.5"
      style={{
        borderColor: `${colors.accentColor}1a`,
        backgroundColor: colors.headerColor,
      }}
    >
      <div className="relative w-full aspect-square">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 176px, 224px"
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
        {hasDiscount && item.discount_value ? (
          <div className="absolute top-2 left-2 bg-red-500 text-white px-2 py-0.5 rounded text-[10px] font-bold">
            {item.discount_type === 'percentage'
              ? `${item.discount_value}% OFF`
              : `-${formatCurrency(Number(item.discount_value))}`}
          </div>
        ) : null}
        <button
          onClick={handleAdd}
          aria-label={`Add ${item.name} to cart`}
          className="absolute top-2 right-2 w-9 h-9 rounded-full flex items-center justify-center shadow-md transition-transform active:scale-95"
          style={{
            backgroundColor: colors.buttonColor,
            color: colors.buttonTextColor,
          }}
        >
          <Plus className="w-5 h-5" strokeWidth={2.5} />
        </button>
      </div>
      <div className="p-3">
        <p
          className="text-sm font-bold line-clamp-1"
          style={{ color: colors.textColor }}
        >
          {item.name}
        </p>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          {hasDiscount ? (
            <>
              <span
                className="text-[11px] line-through"
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
        </div>
      </div>
    </Link>
  );
}

/* ============================ Hot picks interstitial ============================ */

function HotPicksInterstitial({
  items,
  colors,
  slug,
  onAdd,
  formatCurrency,
}: {
  items: MenuItem[];
  colors: ColorConfig;
  slug: string;
  onAdd: (id: string) => void;
  formatCurrency: (n: number) => string;
}) {
  return (
    <section className="md:hidden">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
          style={{
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
          }}
        >
          <Flame className="w-3.5 h-3.5" />
          Hot picks
        </span>
        <span
          className="text-xs"
          style={{ color: colors.textColor, opacity: 0.6 }}
        >
          Trending in the last 48h
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <HotPickCard
            key={`hot-${item.id}`}
            item={item}
            colors={colors}
            slug={slug}
            onAdd={onAdd}
            formatCurrency={formatCurrency}
          />
        ))}
      </div>
    </section>
  );
}

function HotPickCard({
  item,
  colors,
  slug,
  onAdd,
  formatCurrency,
}: {
  item: MenuItem;
  colors: ColorConfig;
  slug: string;
  onAdd: (id: string) => void;
  formatCurrency: (n: number) => string;
}) {
  const hasAddons = item.addons && item.addons.length > 0;
  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasAddons) {
      window.location.href = `/${slug}/add-on?itemId=${item.id}`;
    } else {
      onAdd(item.id);
    }
  };

  return (
    <Link
      href={`/${slug}/${item.id}`}
      className="group relative rounded-2xl overflow-hidden border-2 shadow-sm"
      style={{
        borderColor: '#fecaca',
        background:
          'linear-gradient(180deg, #fff7f5 0%, #ffffff 60%)',
      }}
    >
      <div className="relative w-full aspect-square overflow-hidden">
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, 200px"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-red-50">
            <Flame className="w-10 h-10 text-red-400" />
          </div>
        )}
        <div className="absolute top-2 left-2 inline-flex items-center gap-1 bg-red-600 text-white px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider shadow">
          <Flame className="w-3 h-3" />
          Hot
        </div>
        <button
          onClick={handleAdd}
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
      <div className="p-3">
        <p
          className="text-sm font-bold line-clamp-1"
          style={{ color: colors.textColor }}
        >
          {item.name}
        </p>
        <div className="mt-1 flex items-center gap-2 flex-wrap">
          <span
            className="text-sm font-bold"
            style={{ color: '#b91c1c' }}
          >
            {formatCurrency(Number(item.price))}
          </span>
          {(item.order_count || 0) > 0 && (
            <span className="flex items-center gap-1 text-xs font-medium text-red-700/80">
              <ThumbsUp className="w-3 h-3" />
              {item.order_count}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}

/* ============================ Menu row ============================ */

function MenuRow({
  item,
  colors,
  rank,
  isHot,
  slug,
  onAdd,
  formatCurrency,
}: {
  item: MenuItem;
  colors: ColorConfig;
  rank?: number;
  isHot?: boolean;
  slug: string;
  onAdd: (id: string) => void;
  formatCurrency: (n: number) => string;
}) {
  const hasAddons = item.addons && item.addons.length > 0;
  const hasDiscount = item.discount_type && item.original_price;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasAddons) {
      window.location.href = `/${slug}/add-on?itemId=${item.id}`;
    } else {
      onAdd(item.id);
    }
  };

  return (
    <Link
      href={`/${slug}/${item.id}`}
      className="py-4 md:py-3 flex gap-4 items-start cursor-pointer md:rounded-2xl md:px-3 md:hover:bg-black/[0.02] transition-colors"
      style={
        isHot
          ? {
            borderLeft: '3px solid #ef4444',
            paddingLeft: 12,
          }
          : undefined
      }
      aria-label={`View details for ${item.name}`}
    >
      <div className="flex-1 min-w-0">
        {isHot && (
          <div className="mb-1">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-600 text-white">
              <Flame className="w-3 h-3" />
              Hot pick
            </span>
          </div>
        )}
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

      <div className="relative w-28 h-28 sm:w-32 sm:h-32 md:w-28 md:h-28 flex-shrink-0">
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
          onClick={handleAdd}
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
    </Link>
  );
}

/* ============================ Featured / Most-liked card ============================ */

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

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (hasAddons) {
      window.location.href = `/${slug}/add-on?itemId=${item.id}`;
    } else {
      onAdd(item.id);
    }
  };

  return (
    <Link href={`/${slug}/${item.id}`} className="flex flex-col cursor-pointer">
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
          onClick={handleAdd}
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
    </Link>
  );
}

/* ============================ Drinks ============================ */

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
        className="text-lg md:text-xl font-bold mb-3"
        style={{ color: colors.textColor }}
      >
        Drinks
      </h2>
      <div
        className="md:grid md:grid-cols-2 md:gap-x-6 md:gap-y-2 divide-y md:divide-y-0"
        style={{ borderColor: `${colors.accentColor}1a` }}
      >
        {drinks.map((drink) => (
          <article
            key={drink.id}
            className="py-4 md:py-3 flex gap-4 items-start md:rounded-2xl md:px-3"
          >
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

            <div className="relative w-28 h-28 sm:w-32 sm:h-32 md:w-28 md:h-28 flex-shrink-0">
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
