import { NextResponse } from 'next/server';
import { getAll } from '@/lib/db';

/**
 * Public, restaurant-agnostic list of menu item names that are "popular" across
 * the FoodBase platform. We:
 *   - lower-case + trim names so "Jollof Rice" and "jollof rice" merge
 *   - require the name to appear in at least 2 distinct active businesses
 *   - rank by total order_count across those businesses
 * Falls back to most-used names when no orders exist yet.
 */
export async function GET() {
  try {
    const rows = await getAll(
      `WITH normalized AS (
         SELECT
           INITCAP(LOWER(TRIM(m.name))) AS display_name,
           LOWER(TRIM(m.name)) AS key,
           COALESCE(m.order_count, 0) AS oc,
           m.business_id
         FROM menu_items m
         JOIN businesses b ON b.id = m.business_id
         WHERE m.is_available = true
           AND b.is_active = true
           AND m.name IS NOT NULL
           AND LENGTH(TRIM(m.name)) > 0
       ),
       agg AS (
         SELECT
           key,
           MIN(display_name) AS display_name,
           COUNT(DISTINCT business_id) AS restaurants,
           SUM(oc) AS total_orders
         FROM normalized
         GROUP BY key
       )
       SELECT display_name AS name, restaurants, total_orders
         FROM agg
        WHERE restaurants >= 2
        ORDER BY total_orders DESC, restaurants DESC, display_name ASC
        LIMIT 10`,
    );

    // If we don't have enough cross-restaurant overlap yet, fall back to a
    // simple "most popular menu items overall" list so the footer is never empty.
    if (!rows || rows.length === 0) {
      const fallback = await getAll(
        `SELECT INITCAP(LOWER(TRIM(name))) AS name,
                1 AS restaurants,
                COALESCE(order_count, 0) AS total_orders
           FROM menu_items m
           JOIN businesses b ON b.id = m.business_id
          WHERE m.is_available = true
            AND b.is_active = true
            AND m.name IS NOT NULL
            AND LENGTH(TRIM(m.name)) > 0
          ORDER BY COALESCE(order_count, 0) DESC, m.created_at DESC
          LIMIT 10`,
      );
      return NextResponse.json({ items: fallback || [] });
    }

    return NextResponse.json({ items: rows });
  } catch (error) {
    console.error('[v0] popular-items error:', error);
    return NextResponse.json(
      { items: [], error: 'Failed to fetch popular items' },
      { status: 200 },
    );
  }
}
