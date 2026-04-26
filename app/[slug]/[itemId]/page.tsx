'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft,
  ShoppingCart,
  Plus,
  Minus,
  ThumbsUp,
  UtensilsCrossed,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  fetchColorConfig,
  type ColorConfig,
  DEFAULT_COLORS,
} from '@/lib/color-config';

/* ----------------------------- Types ----------------------------- */

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
  image_url?: string;
  options: AddonOption[];
}

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  original_price?: number | null;
  image_url?: string;
  order_count?: number;
  discount_type?: string | null;
  discount_value?: number | null;
  category_id?: string;
  category_name?: string;
  addons?: Addon[];
}

interface PopularDish {
  id: string;
  combination_name: string;
  description?: string;
  featured_image_url?: string;
  is_manual: boolean;
  menu_item_ids?: string;
  order_count?: number;
}

interface Business {
  id: string;
  name: string;
  slug: string;
  logo_url?: string;
}

interface DetailResponse {
  type: 'menu_item' | 'popular_dish';
  business: Business;
  item: any;
  addons: Addon[];
  popularDishes: PopularDish[];
  sameCategoryItems: MenuItem[];
  otherItems: MenuItem[];
  constituentItems: MenuItem[];
}

/* ---------------------------- Page ---------------------------- */

export default function ItemDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const slug = params.slug as string;
  const itemId = params.itemId as string;

  const [data, setData] = useState<DetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [colors, setColors] = useState<ColorConfig>(DEFAULT_COLORS);
  const [quantity, setQuantity] = useState(1);
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const stored = sessionStorage.getItem(`cart_${slug}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setCartCount(Array.isArray(parsed) ? parsed.length : 0);
      } catch {
        setCartCount(0);
      }
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, itemId]);

  const fetchData = async () => {
    try {
      const res = await fetch(`/api/restaurants/${slug}/items/${itemId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load');
      setData(json);
      if (json.business?.id) {
        const c = await fetchColorConfig(json.business.id, 'menu');
        setColors(c);
      }
    } catch (e) {
      console.error('[v0] detail page error:', e);
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);

  const isMenuItem = data?.type === 'menu_item';
  const item = data?.item;
  const addons: Addon[] = data?.addons || [];
  const hasAddons = addons.length > 0;

  /* --------- Resolve display fields from either source --------- */
  const display = useMemo(() => {
    if (!item) return null;
    if (isMenuItem) {
      const i = item as MenuItem;
      return {
        title: i.name,
        description: i.description,
        image: i.image_url,
        price: Number(i.price) || 0,
        originalPrice:
          i.original_price != null && Number(i.original_price) > 0
            ? Number(i.original_price)
            : null,
        discountType: i.discount_type || null,
        discountValue: i.discount_value ? Number(i.discount_value) : null,
        orderCount: i.order_count || 0,
        categoryName: i.category_name,
      };
    }
    const p = item as PopularDish;
    return {
      title: p.combination_name,
      description: p.description,
      image: p.featured_image_url,
      price: 0,
      originalPrice: null as number | null,
      discountType: null as string | null,
      discountValue: null as number | null,
      orderCount: p.order_count || 0,
      categoryName: undefined as string | undefined,
    };
  }, [item, isMenuItem]);

  /* ---------------------- Cart actions ---------------------- */

  const addMenuItemDirectlyToCart = () => {
    if (!isMenuItem || !item) return;
    const i = item as MenuItem;
    const stored = sessionStorage.getItem(`cart_${slug}`);
    let cart: any[] = [];
    try {
      cart = stored ? JSON.parse(stored) : [];
    } catch {
      cart = [];
    }

    const existing = cart.find(
      (c) =>
        c.id === i.id &&
        c.type === 'menu' &&
        (!c.addons || c.addons.length === 0)
    );

    if (existing) {
      cart = cart.map((c) =>
        c === existing ? { ...c, quantity: c.quantity + quantity } : c
      );
    } else {
      cart.push({
        id: i.id,
        cartKey: i.id,
        type: 'menu',
        name: i.name,
        price: Number(i.price),
        image_url: i.image_url,
        quantity: Number(quantity),
        addons: [],
      });
    }
    sessionStorage.setItem(`cart_${slug}`, JSON.stringify(cart));
    setCartCount(cart.length);
    toast({
      title: 'Added to cart',
      description: `${i.name} has been added to your cart`,
    });
  };

  const handleAddToCart = () => {
    if (!isMenuItem) {
      // Popular dish (manual): can't add directly — guide to constituent items
      toast({
        title: 'Choose an item',
        description: 'Pick one of the dishes in this combo to add to cart.',
      });
      return;
    }
    if (hasAddons) {
      router.push(`/${slug}/add-on?itemId=${itemId}&qty=${quantity}`);
    } else {
      addMenuItemDirectlyToCart();
    }
  };

  /* ---------------------- Render states ---------------------- */

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: colors.backgroundColor }}
      >
        <p style={{ color: colors.textColor, opacity: 0.7 }}>Loading…</p>
      </div>
    );
  }

  if (error || !data || !display) {
    return (
      <div
        className="min-h-screen"
        style={{ backgroundColor: colors.backgroundColor }}
      >
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
              className="p-1 rounded"
              style={{ color: colors.headerTextColor }}
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1
              className="text-lg font-bold"
              style={{ color: colors.headerTextColor }}
            >
              Not found
            </h1>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center text-center p-6 mt-8">
          <AlertCircle
            className="w-10 h-10 mb-3"
            style={{ color: colors.accentColor }}
          />
          <p style={{ color: colors.textColor }} className="mb-4">
            {error || 'This item could not be found.'}
          </p>
          <Link href={`/${slug}`}>
            <Button
              variant="outline"
              style={{
                borderColor: colors.accentColor,
                color: colors.accentColor,
              }}
            >
              Back to menu
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const hasDiscount =
    !!display.discountType && !!display.originalPrice && display.originalPrice > display.price;

  return (
    <div
      className="min-h-screen pb-32"
      style={{ backgroundColor: colors.backgroundColor }}
    >
      {/* Top sticky bar with back + cart */}
      <header
        className="sticky top-0 z-40 backdrop-blur-md"
        style={{
          backgroundColor: `${colors.headerColor}f2`,
          borderBottom: `1px solid ${colors.accentColor}1a`,
        }}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            aria-label="Back"
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: `${colors.accentColor}14`,
              color: colors.headerTextColor,
            }}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <h1
            className="text-sm font-semibold truncate mx-3"
            style={{ color: colors.headerTextColor }}
          >
            {display.title}
          </h1>

          <Link
            href={`/${slug}/cart`}
            aria-label="View cart"
            className="relative w-10 h-10 rounded-full flex items-center justify-center"
            style={{
              backgroundColor: `${colors.accentColor}14`,
              color: colors.headerTextColor,
            }}
          >
            <ShoppingCart className="w-5 h-5" />
            {cartCount > 0 && (
              <span
                className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center"
                style={{
                  backgroundColor: colors.accentColor,
                  color: colors.buttonTextColor,
                }}
              >
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-0 sm:px-4">
        {/* ---------- Hero / image + info ---------- */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-0 md:gap-6 md:pt-6">
          {/* Image */}
          <div className="relative w-full aspect-[4/3] md:aspect-square md:rounded-2xl overflow-hidden">
            {display.image ? (
              <Image
                src={display.image}
                alt={display.title}
                fill
                priority
                className="object-cover"
                sizes="(max-width: 768px) 100vw, 50vw"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: `${colors.accentColor}1a` }}
              >
                <UtensilsCrossed
                  className="w-14 h-14"
                  style={{ color: colors.accentColor, opacity: 0.6 }}
                />
              </div>
            )}

            {hasDiscount && display.discountValue ? (
              <div className="absolute top-3 left-3 bg-red-500 text-white px-2.5 py-1 rounded-md text-xs font-bold shadow-md">
                {display.discountType === 'percentage'
                  ? `${display.discountValue}% OFF`
                  : `-${formatCurrency(display.discountValue)}`}
              </div>
            ) : null}

            {!isMenuItem && (
              <div
                className="absolute top-3 right-3 px-2.5 py-1 rounded-md text-xs font-bold shadow-md"
                style={{
                  backgroundColor: colors.accentColor,
                  color: colors.buttonTextColor,
                }}
              >
                Popular
              </div>
            )}
          </div>

          {/* Info */}
          <div className="px-4 sm:px-0 py-5 md:py-2 flex flex-col">
            {display.categoryName && (
              <span
                className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: colors.accentColor }}
              >
                {display.categoryName}
              </span>
            )}

            <h2
              className="text-2xl sm:text-3xl font-bold tracking-tight text-pretty"
              style={{ color: colors.textColor }}
            >
              {display.title}
            </h2>

            {display.description && (
              <p
                className="mt-3 text-sm sm:text-base leading-relaxed"
                style={{ color: colors.textColor, opacity: 0.75 }}
              >
                {display.description}
              </p>
            )}

            {(display.orderCount || 0) > 0 && (
              <div className="mt-3 flex items-center gap-2">
                <ThumbsUp
                  className="w-4 h-4"
                  style={{ color: colors.accentColor }}
                />
                <span
                  className="text-sm font-medium"
                  style={{ color: colors.textColor, opacity: 0.75 }}
                >
                  Ordered {display.orderCount} {display.orderCount === 1 ? 'time' : 'times'}
                </span>
              </div>
            )}

            {/* Price */}
            {isMenuItem && (
              <div className="mt-5 flex items-end gap-3 flex-wrap">
                {hasDiscount ? (
                  <>
                    <span
                      className="text-base line-through"
                      style={{ color: colors.textColor, opacity: 0.5 }}
                    >
                      {formatCurrency(Number(display.originalPrice))}
                    </span>
                    <span
                      className="text-3xl font-bold"
                      style={{ color: colors.accentColor }}
                    >
                      {formatCurrency(display.price)}
                    </span>
                  </>
                ) : (
                  <span
                    className="text-3xl font-bold"
                    style={{ color: colors.textColor }}
                  >
                    {formatCurrency(display.price)}
                  </span>
                )}
              </div>
            )}

            {/* Addon images (overlapping) */}
            {hasAddons && (
              <AddonImagesRow
                slug={slug}
                itemId={itemId}
                addons={addons}
                colors={colors}
                quantity={quantity}
              />
            )}

            {/* Constituent items (manual popular dish) */}
            {!isMenuItem && data.constituentItems.length > 0 && (
              <div className="mt-6">
                <h3
                  className="text-sm font-semibold uppercase tracking-wider mb-3"
                  style={{ color: colors.textColor, opacity: 0.7 }}
                >
                  Items in this combo
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  {data.constituentItems.map((ci) => (
                    <Link
                      key={ci.id}
                      href={`/${slug}/${ci.id}`}
                      className="group rounded-xl overflow-hidden border"
                      style={{
                        borderColor: `${colors.accentColor}1a`,
                        backgroundColor: colors.headerColor,
                      }}
                    >
                      <div className="relative w-full aspect-square">
                        {ci.image_url ? (
                          <Image
                            src={ci.image_url}
                            alt={ci.name}
                            fill
                            className="object-cover group-hover:scale-[1.03] transition-transform"
                            sizes="(max-width: 768px) 50vw, 200px"
                          />
                        ) : (
                          <div
                            className="w-full h-full flex items-center justify-center"
                            style={{ backgroundColor: `${colors.accentColor}1a` }}
                          >
                            <UtensilsCrossed
                              className="w-8 h-8"
                              style={{
                                color: colors.accentColor,
                                opacity: 0.6,
                              }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="p-3">
                        <p
                          className="text-sm font-semibold line-clamp-1"
                          style={{ color: colors.textColor }}
                        >
                          {ci.name}
                        </p>
                        <p
                          className="text-sm font-bold mt-1"
                          style={{ color: colors.accentColor }}
                        >
                          {formatCurrency(Number(ci.price))}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ---------- Popular dishes carousel ---------- */}
        {data.popularDishes.length > 0 && (
          <PopularDishesCarousel
            slug={slug}
            popularDishes={data.popularDishes}
            colors={colors}
          />
        )}

        {/* ---------- Same category items ---------- */}
        {data.sameCategoryItems.length > 0 && (
          <ItemsCarousel
            title={
              display.categoryName
                ? `More from ${display.categoryName}`
                : 'Similar items'
            }
            slug={slug}
            items={data.sameCategoryItems}
            colors={colors}
            formatCurrency={formatCurrency}
          />
        )}

        {/* ---------- Other items ---------- */}
        {data.otherItems.length > 0 && (
          <ItemsCarousel
            title="You might also like"
            slug={slug}
            items={data.otherItems}
            colors={colors}
            formatCurrency={formatCurrency}
          />
        )}
      </main>

      {/* ---------- Sticky bottom CTA ---------- */}
      {isMenuItem && (
        <div
          className="fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-md"
          style={{
            backgroundColor: `${colors.headerColor}f2`,
            borderColor: `${colors.accentColor}1a`,
          }}
        >
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            {/* Quantity stepper */}
            <div
              className="flex items-center gap-2 rounded-full"
              style={{
                backgroundColor: `${colors.accentColor}14`,
              }}
            >
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                aria-label="Decrease quantity"
                className="w-9 h-9 rounded-full flex items-center justify-center disabled:opacity-40"
                disabled={quantity <= 1}
                style={{ color: colors.textColor }}
              >
                <Minus className="w-4 h-4" />
              </button>
              <span
                className="min-w-6 text-center text-sm font-bold"
                style={{ color: colors.textColor }}
              >
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(quantity + 1)}
                aria-label="Increase quantity"
                className="w-9 h-9 rounded-full flex items-center justify-center"
                style={{ color: colors.textColor }}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <Button
              onClick={handleAddToCart}
              className="flex-1 h-11 rounded-full font-semibold shadow-md"
              style={{
                backgroundColor: colors.buttonColor,
                color: colors.buttonTextColor,
              }}
            >
              {hasAddons ? (
                <span>Customise &amp; add</span>
              ) : (
                <span>
                  Add to cart ·{' '}
                  {formatCurrency(display.price * quantity)}
                </span>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------------------- Subcomponents ----------------------- */

function AddonImagesRow({
  slug,
  itemId,
  addons,
  colors,
  quantity,
}: {
  slug: string;
  itemId: string;
  addons: Addon[];
  colors: ColorConfig;
  quantity: number;
}) {
  // Take a representative image from each addon (first option image, then addon image)
  const items = addons
    .map((a) => {
      const optionWithImg = a.options?.find((o) => !!o.image_url);
      return {
        id: a.id,
        name: a.name,
        image: optionWithImg?.image_url || a.image_url || null,
      };
    })
    .filter((x) => x.image);

  if (items.length === 0) {
    // Still show the entry as a tappable section (no images available)
    return (
      <Link
        href={`/${slug}/add-on?itemId=${itemId}&qty=${quantity}`}
        className="mt-6 inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm self-start"
        style={{
          backgroundColor: `${colors.accentColor}14`,
          color: colors.accentColor,
        }}
      >
        <Plus className="w-4 h-4" />
        Customise this item ({addons.length})
      </Link>
    );
  }

  const visible = items.slice(0, 5);
  const extra = items.length - visible.length;

  return (
    <div className="mt-6">
      <h3
        className="text-sm font-semibold uppercase tracking-wider mb-3"
        style={{ color: colors.textColor, opacity: 0.7 }}
      >
        Add-ons
      </h3>
      <Link
        href={`/${slug}/add-on?itemId=${itemId}&qty=${quantity}`}
        className="flex items-center gap-3 group"
      >
        <div className="flex -space-x-3">
          {visible.map((it) => (
            <div
              key={it.id}
              className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full overflow-hidden ring-2 transition-transform group-hover:translate-y-[-2px]"
              style={{
                // ring uses background color so circles "punch out" cleanly
                // @ts-ignore — CSS var
                ['--tw-ring-color' as any]: colors.backgroundColor,
                boxShadow: `0 0 0 2px ${colors.backgroundColor}`,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={it.image as string}
                alt={it.name}
                className="object-cover w-full h-full"
              />
            </div>
          ))}
          {extra > 0 && (
            <div
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-xs font-bold ring-2"
              style={{
                backgroundColor: colors.accentColor,
                color: colors.buttonTextColor,
                boxShadow: `0 0 0 2px ${colors.backgroundColor}`,
              }}
            >
              +{extra}
            </div>
          )}
        </div>
        <div className="flex flex-col">
          <span
            className="text-sm font-semibold"
            style={{ color: colors.textColor }}
          >
            Customise with add-ons
          </span>
          <span
            className="text-xs"
            style={{ color: colors.textColor, opacity: 0.6 }}
          >
            Tap to choose your add-ons
          </span>
        </div>
      </Link>
    </div>
  );
}

/* ------------ Carousel: Popular dishes (from popular_dishes) ------------ */

function PopularDishesCarousel({
  slug,
  popularDishes,
  colors,
}: {
  slug: string;
  popularDishes: PopularDish[];
  colors: ColorConfig;
}) {
  /**
   * Click rule:
   * - Auto-generated dishes (is_manual=false): if there is a single menu_item id,
   *   navigate to that menu item detail page.
   * - Manual dishes: navigate to /[slug]/[popular_dish_id].
   */
  const hrefFor = (d: PopularDish) => {
    if (!d.is_manual) {
      const ids = String(d.menu_item_ids || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length === 1) return `/${slug}/${ids[0]}`;
    }
    return `/${slug}/${d.id}`;
  };

  return (
    <ScrollSection
      title="Popular dishes"
      colors={colors}
    >
      {popularDishes.map((d) => (
        <Link
          key={d.id}
          href={hrefFor(d)}
          className="snap-start flex-shrink-0 w-44 sm:w-52 rounded-2xl overflow-hidden border transition-transform hover:-translate-y-0.5"
          style={{
            borderColor: `${colors.accentColor}1a`,
            backgroundColor: colors.headerColor,
          }}
        >
          <div className="relative w-full aspect-square">
            {d.featured_image_url ? (
              <Image
                src={d.featured_image_url}
                alt={d.combination_name}
                fill
                className="object-cover"
                sizes="(max-width: 640px) 176px, 208px"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center"
                style={{ backgroundColor: `${colors.accentColor}1a` }}
              >
                <UtensilsCrossed
                  className="w-8 h-8"
                  style={{ color: colors.accentColor, opacity: 0.6 }}
                />
              </div>
            )}
            <div
              className="absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold"
              style={{
                backgroundColor: colors.accentColor,
                color: colors.buttonTextColor,
              }}
            >
              Popular
            </div>
          </div>
          <div className="p-3">
            <p
              className="text-sm font-bold line-clamp-1"
              style={{ color: colors.textColor }}
            >
              {d.combination_name}
            </p>
            {d.description && (
              <p
                className="mt-1 text-xs line-clamp-2 leading-relaxed"
                style={{ color: colors.textColor, opacity: 0.65 }}
              >
                {d.description}
              </p>
            )}
            {(d.order_count || 0) > 0 && (
              <div
                className="mt-2 flex items-center gap-1 text-xs"
                style={{ color: colors.textColor, opacity: 0.7 }}
              >
                <ThumbsUp
                  className="w-3 h-3"
                  style={{ color: colors.accentColor }}
                />
                <span>({d.order_count})</span>
              </div>
            )}
          </div>
        </Link>
      ))}
    </ScrollSection>
  );
}

/* ------------ Carousel: Generic menu items ------------ */

function ItemsCarousel({
  title,
  slug,
  items,
  colors,
  formatCurrency,
}: {
  title: string;
  slug: string;
  items: MenuItem[];
  colors: ColorConfig;
  formatCurrency: (n: number) => string;
}) {
  return (
    <ScrollSection title={title} colors={colors}>
      {items.map((it) => {
        const hasDiscount =
          !!it.discount_type &&
          !!it.original_price &&
          Number(it.original_price) > Number(it.price);
        return (
          <Link
            key={it.id}
            href={`/${slug}/${it.id}`}
            className="snap-start flex-shrink-0 w-40 sm:w-48 rounded-2xl overflow-hidden border transition-transform hover:-translate-y-0.5"
            style={{
              borderColor: `${colors.accentColor}1a`,
              backgroundColor: colors.headerColor,
            }}
          >
            <div className="relative w-full aspect-square">
              {it.image_url ? (
                <Image
                  src={it.image_url}
                  alt={it.name}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 160px, 192px"
                />
              ) : (
                <div
                  className="w-full h-full flex items-center justify-center"
                  style={{ backgroundColor: `${colors.accentColor}1a` }}
                >
                  <UtensilsCrossed
                    className="w-8 h-8"
                    style={{ color: colors.accentColor, opacity: 0.6 }}
                  />
                </div>
              )}
              {hasDiscount && it.discount_value ? (
                <div className="absolute top-2 left-2 bg-red-500 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
                  {it.discount_type === 'percentage'
                    ? `${it.discount_value}% OFF`
                    : `-${formatCurrency(Number(it.discount_value))}`}
                </div>
              ) : null}
            </div>
            <div className="p-3">
              <p
                className="text-sm font-bold line-clamp-1"
                style={{ color: colors.textColor }}
              >
                {it.name}
              </p>
              {it.description && (
                <p
                  className="mt-1 text-xs line-clamp-2 leading-relaxed"
                  style={{ color: colors.textColor, opacity: 0.65 }}
                >
                  {it.description}
                </p>
              )}
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {hasDiscount ? (
                  <>
                    <span
                      className="text-[10px] line-through"
                      style={{ color: colors.textColor, opacity: 0.5 }}
                    >
                      {formatCurrency(Number(it.original_price))}
                    </span>
                    <span
                      className="text-sm font-bold"
                      style={{ color: colors.accentColor }}
                    >
                      {formatCurrency(Number(it.price))}
                    </span>
                  </>
                ) : (
                  <span
                    className="text-sm font-bold"
                    style={{ color: colors.textColor }}
                  >
                    {formatCurrency(Number(it.price))}
                  </span>
                )}
                {(it.order_count || 0) > 0 && (
                  <span
                    className="flex items-center gap-1 text-[10px]"
                    style={{ color: colors.textColor, opacity: 0.65 }}
                  >
                    <ThumbsUp
                      className="w-3 h-3"
                      style={{ color: colors.accentColor }}
                    />
                    {it.order_count}
                  </span>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </ScrollSection>
  );
}

/* ------------ Reusable horizontal scroll section ------------ */

function ScrollSection({
  title,
  children,
  colors,
}: {
  title: string;
  children: React.ReactNode;
  colors: ColorConfig;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  const scrollBy = (dir: 'left' | 'right') => {
    const el = scrollerRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.8;
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' });
  };

  return (
    <section className="mt-8 px-4 sm:px-0">
      <div className="flex items-end justify-between mb-3">
        <h3
          className="text-lg sm:text-xl font-bold tracking-tight"
          style={{ color: colors.textColor }}
        >
          {title}
        </h3>
        <div className="hidden sm:flex items-center gap-2">
          <button
            aria-label="Scroll left"
            onClick={() => scrollBy('left')}
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
            onClick={() => scrollBy('right')}
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
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 sm:mx-0 px-4 sm:px-0 scroll-smooth [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: 'none' }}
      >
        {children}
      </div>
    </section>
  );
}
