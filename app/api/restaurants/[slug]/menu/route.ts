import { NextRequest, NextResponse } from 'next/server';
import { getOne, getAll } from '@/lib/db';
import { getBusinessHours, isOpenAt, describeToday, type DayHours } from '@/lib/business-hours';

/**
 * Restaurant storefront menu endpoint.
 *
 * In addition to the basic business + categories + menu_items + drinks payload,
 * this endpoint computes:
 *   - featured: one menu item picked from each category, in randomised order.
 *       Per category we pick:
 *         1) item with the highest order_count (>0); else
 *         2) cheapest item (min price); ties broken by most-recent created_at.
 *   - hotPicks: top 5 menu items by orders placed in the last 48 hours
 *       (joined through order_items + orders).
 *   - business now also returns address, phone and availability so the storefront
 *     "info" panel can be populated.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // -------- Business lookup --------
    const business = await getOne(
      'SELECT * FROM businesses WHERE slug = $1 AND is_active = true',
      [slug]
    );

    if (!business) {
      return NextResponse.json(
        { error: 'Restaurant not found' },
        { status: 404 }
      );
    }

    // -------- Categories --------
    const categories = await getAll(
      'SELECT * FROM categories WHERE business_id = $1 ORDER BY display_order, created_at DESC',
      [business.id]
    );

    // -------- Menu items --------
    const menuItems = await getAll(
      `SELECT m.id, m.name, m.description, m.price, m.original_price, m.image_url,
              m.is_available, m.display_order, m.category_id, m.is_popular,
              m.order_count, m.discount_type, m.discount_value, m.created_at,
              c.name AS category_name
         FROM menu_items m
         LEFT JOIN categories c ON m.category_id = c.id
        WHERE m.business_id = $1 AND m.is_available = true
        ORDER BY m.display_order, m.created_at DESC`,
      [business.id]
    );

    // -------- Add-ons (per item) --------
    const menuItemsWithAddons = await Promise.all(
      menuItems.map(async (item: any) => {
        try {
          const addons = await getAll(
            `SELECT a.id, a.name, a.addon_type, a.is_required, a.allow_multiple, a.description, a.image_url
               FROM menu_item_addons mia
               LEFT JOIN addons a ON mia.addon_id = a.id
              WHERE mia.menu_item_id = $1
              GROUP BY a.id, a.name, a.addon_type, a.is_required, a.allow_multiple, a.description, a.image_url`,
            [item.id]
          );
          const addonsWithOptions = await Promise.all(
            (addons || []).map(async (addon: any) => {
              const options = await getAll(
                'SELECT * FROM addon_options WHERE addon_id = $1 ORDER BY display_order, created_at',
                [addon.id]
              );
              return { ...addon, options: options || [] };
            })
          );
          return { ...item, addons: addonsWithOptions };
        } catch {
          return { ...item, addons: [] };
        }
      })
    );

    // -------- Drinks --------
    const drinks = await getAll(
      'SELECT * FROM drinks WHERE business_id = $1 AND is_available = true ORDER BY display_order, created_at DESC',
      [business.id]
    );

    // -------- Popular dishes --------
    const popularDishes = await getAll(
      'SELECT * FROM popular_dishes WHERE business_id = $1 ORDER BY display_order, created_at DESC LIMIT 5',
      [business.id]
    );

    // -------- Hot picks (last 48h) --------
    // Uses paid orders' items to count true sales. Falls back to empty list if none.
    const hotPicksRows = await getAll(
      `SELECT m.id, m.name, m.description, m.price, m.original_price, m.image_url,
              m.is_available, m.display_order, m.category_id, m.is_popular,
              m.order_count, m.discount_type, m.discount_value,
              c.name AS category_name,
              COALESCE(SUM(oi.quantity), 0)::int AS recent_orders
         FROM menu_items m
         LEFT JOIN categories c ON m.category_id = c.id
         JOIN order_items oi ON oi.menu_item_id = m.id
         JOIN orders o ON o.id = oi.order_id
        WHERE m.business_id = $1
          AND m.is_available = true
          AND o.business_id = $1
          AND o.created_at >= NOW() - INTERVAL '48 hours'
        GROUP BY m.id, c.name
        HAVING COALESCE(SUM(oi.quantity), 0) > 0
        ORDER BY recent_orders DESC, m.created_at DESC
        LIMIT 5`,
      [business.id]
    );

    // Re-attach addons we already loaded so hot picks render consistently.
    const addonsById = new Map<string, any[]>();
    menuItemsWithAddons.forEach((m: any) => addonsById.set(m.id, m.addons || []));
    const hotPicks = (hotPicksRows || []).map((r: any) => ({
      ...r,
      addons: addonsById.get(r.id) || [],
    }));
    const hotPickIds = new Set<string>(hotPicks.map((h) => h.id));

    // -------- Featured (one per category, randomised) --------
    const featured: any[] = [];
    if (categories.length > 0) {
      for (const cat of categories) {
        const itemsInCat = menuItemsWithAddons.filter(
          (m: any) => m.category_id === cat.id
        );
        if (itemsInCat.length === 0) continue;

        const withOrders = itemsInCat.filter((m: any) => Number(m.order_count) > 0);
        let chosen: any = null;

        if (withOrders.length > 0) {
          chosen = withOrders.reduce((best: any, cur: any) =>
            Number(cur.order_count) > Number(best.order_count) ? cur : best
          );
        } else {
          // Cheapest; ties broken by most recent created_at.
          chosen = [...itemsInCat].sort((a: any, b: any) => {
            const pa = Number(a.price);
            const pb = Number(b.price);
            if (pa !== pb) return pa - pb;
            const ta = new Date(a.created_at).getTime();
            const tb = new Date(b.created_at).getTime();
            return tb - ta;
          })[0];
        }
        if (chosen) featured.push(chosen);
      }
      // Randomise (Fisher–Yates) so each visit feels fresh.
      for (let i = featured.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [featured[i], featured[j]] = [featured[j], featured[i]];
      }
    }

    // -------- Opening hours (Batch 3A, additive) --------
    // Never let hours break the menu: a failure here just omits the field.
    let hours: { days: DayHours[]; isOpenNow: boolean; acceptOrdersOutsideHours: boolean; today: string } | null = null;
    try {
      const hoursState = await getBusinessHours(business.id);
      const now = new Date();
      hours = {
        days: hoursState.days,
        isOpenNow: isOpenAt(hoursState.days, now),
        acceptOrdersOutsideHours: hoursState.acceptOrdersOutsideHours,
        today: describeToday(hoursState.days, now),
      };
    } catch (hoursError) {
      console.error('[menu] hours unavailable', hoursError);
    }

    const response = {
      success: true,
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        description: business.description,
        logo_url: business.logo_url,
        cover_image_url: business.cover_image_url,
        email: business.email,
        phone: business.phone,
        address: business.address,
        city: business.city,
        state: business.state,
        country: business.country,
        availability: business.availability ?? null,
        // Additive: open/closed for the storefront badge. Null when unknown.
        hours,
        accept_orders_outside_hours:
          typeof business.accept_orders_outside_hours === 'boolean'
            ? business.accept_orders_outside_hours
            : true,
      },
      categories,
      menuItems: menuItemsWithAddons,
      drinks,
      popularDishes,
      featured,
      hotPicks,
      hotPickIds: Array.from(hotPickIds),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[v0] Get menu error:', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch menu',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
