import { NextRequest, NextResponse } from 'next/server';
import { getOne, getAll } from '@/lib/db';

/**
 * Unified detail endpoint for either a menu item or a manual popular dish.
 * - First tries to find a menu_item with the given id.
 * - If not found, falls back to popular_dishes.
 *
 * Returns:
 *   {
 *     type: 'menu_item' | 'popular_dish',
 *     business,
 *     item,                  // the matched record (menu item OR popular dish)
 *     addons,                // hydrated addons (menu_item only)
 *     popularDishes,         // raw popular_dishes rows for carousel
 *     sameCategoryItems,     // menu items in the same category (excludes current)
 *     otherItems,            // remaining menu items (not in same category)
 *     constituentItems       // resolved menu items for popular_dish (when applicable)
 *   }
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; itemId: string }> }
) {
  try {
    const { slug, itemId } = await params;

    const business = await getOne(
      'SELECT id, name, slug, description, logo_url, cover_image_url, email, phone FROM businesses WHERE slug = $1 AND is_active = true',
      [slug]
    );

    if (!business) {
      return NextResponse.json({ error: 'Restaurant not found' }, { status: 404 });
    }

    // Try menu item first
    const menuItem = await getOne(
      `SELECT m.id, m.name, m.description, m.price, m.original_price, m.image_url, m.is_available,
              m.display_order, m.category_id, m.is_popular, m.order_count,
              m.discount_type, m.discount_value,
              c.name as category_name
       FROM menu_items m
       LEFT JOIN categories c ON m.category_id = c.id
       WHERE m.business_id = $1 AND m.id = $2`,
      [business.id, itemId]
    );

    // Common: list of popular dishes for the horizontal carousel
    const popularDishes = await getAll(
      `SELECT id, combination_name, description, featured_image_url, is_manual, menu_item_ids, order_count
       FROM popular_dishes
       WHERE business_id = $1
       ORDER BY display_order, created_at DESC
       LIMIT 12`,
      [business.id]
    );

    if (menuItem) {
      // Get addons hydrated with options
      const addons = await getAll(
        `SELECT a.id, a.name, a.addon_type, a.is_required, a.allow_multiple, a.description, a.image_url
         FROM menu_item_addons mia
         LEFT JOIN addons a ON mia.addon_id = a.id
         WHERE mia.menu_item_id = $1
         GROUP BY a.id, a.name, a.addon_type, a.is_required, a.allow_multiple, a.description, a.image_url`,
        [menuItem.id]
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

      // Same-category items (excluding current)
      const sameCategoryItems = menuItem.category_id
        ? await getAll(
            `SELECT id, name, description, price, original_price, image_url, order_count, discount_type, discount_value
             FROM menu_items
             WHERE business_id = $1 AND category_id = $2 AND id <> $3 AND is_available = true
             ORDER BY display_order, created_at DESC
             LIMIT 12`,
            [business.id, menuItem.category_id, menuItem.id]
          )
        : [];

      // Other items (not in same category and not the current one)
      const otherItems = await getAll(
        `SELECT id, name, description, price, original_price, image_url, order_count, discount_type, discount_value
         FROM menu_items
         WHERE business_id = $1
           AND id <> $2
           AND ($3::varchar IS NULL OR category_id IS DISTINCT FROM $3::varchar)
           AND is_available = true
         ORDER BY display_order, created_at DESC
         LIMIT 12`,
        [business.id, menuItem.id, menuItem.category_id || null]
      );

      return NextResponse.json({
        success: true,
        type: 'menu_item',
        business,
        item: { ...menuItem, addons: addonsWithOptions },
        addons: addonsWithOptions,
        popularDishes,
        sameCategoryItems,
        otherItems,
        constituentItems: [],
      });
    }

    // Fallback: try as popular_dish
    const popularDish = await getOne(
      `SELECT id, combination_name, description, featured_image_url, is_manual, menu_item_ids, order_count
       FROM popular_dishes WHERE id = $1 AND business_id = $2`,
      [itemId, business.id]
    );

    if (!popularDish) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    // Resolve constituent menu items (if any)
    let constituentItems: any[] = [];
    if (popularDish.menu_item_ids) {
      const ids = String(popularDish.menu_item_ids)
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean);

      if (ids.length > 0) {
        constituentItems = await getAll(
          `SELECT id, name, description, price, original_price, image_url, order_count, discount_type, discount_value, category_id
           FROM menu_items
           WHERE business_id = $1 AND id = ANY($2::varchar[]) AND is_available = true`,
          [business.id, ids]
        );
      }
    }

    // Other menu items as a fallback "you might like" list
    const otherItems = await getAll(
      `SELECT id, name, description, price, original_price, image_url, order_count, discount_type, discount_value
       FROM menu_items
       WHERE business_id = $1 AND is_available = true
       ORDER BY display_order, created_at DESC
       LIMIT 12`,
      [business.id]
    );

    return NextResponse.json({
      success: true,
      type: 'popular_dish',
      business,
      item: popularDish,
      addons: [],
      popularDishes,
      sameCategoryItems: [],
      otherItems,
      constituentItems,
    });
  } catch (error) {
    console.error('[v0] item detail error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch item', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
