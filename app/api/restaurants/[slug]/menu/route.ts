import { NextRequest, NextResponse } from 'next/server';
import { getOne, getAll } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Get business by slug
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

    // Get categories
    const categories = await getAll(
      'SELECT * FROM categories WHERE business_id = $1 ORDER BY display_order, created_at DESC',
      [business.id]
    );

    // Get menu items with their add-ons - simplified query without nested JSON aggregation
    const menuItems = await getAll(
      `SELECT m.id, m.name, m.description, m.price, m.image_url, m.is_available, 
              m.display_order, m.category_id, m.is_popular, m.order_count,
              c.name as category_name
       FROM menu_items m
       LEFT JOIN categories c ON m.category_id = c.id
       WHERE m.business_id = $1 AND m.is_available = true
       ORDER BY m.display_order, m.created_at DESC`,
      [business.id]
    );

    // Get addons for each menu item separately to avoid JSON query issues
    const menuItemsWithAddons = await Promise.all(
      menuItems.map(async (item: any) => {
        try {
          const addons = await getAll(
            `SELECT a.id, a.name, a.addon_type, a.is_required
             FROM menu_item_addons mia
             LEFT JOIN addons a ON mia.addon_id = a.id
             WHERE mia.menu_item_id = $1
             GROUP BY a.id, a.name, a.addon_type, a.is_required`,
            [item.id]
          );
          return { ...item, addons: addons || [] };
        } catch (err) {
          // If addon query fails, just return item without addons
          console.error('[v0] Error fetching addons for menu item:', err);
          return { ...item, addons: [] };
        }
      })
    );

    // Get drinks
    const drinks = await getAll(
      'SELECT * FROM drinks WHERE business_id = $1 AND is_available = true ORDER BY display_order, created_at DESC',
      [business.id]
    );

    // Get popular dishes
    const popularDishes = await getAll(
      'SELECT * FROM popular_dishes WHERE business_id = $1 ORDER BY display_order, created_at DESC LIMIT 5',
      [business.id]
    );

    return NextResponse.json({
      success: true,
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        description: business.description,
        logo_url: business.logo_url,
        email: business.email,
        phone: business.phone,
      },
      categories,
      menuItems: menuItemsWithAddons,
      drinks,
      popularDishes,
    });
  } catch (error) {
    console.error('[v0] Get menu error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch menu' },
      { status: 500 }
    );
  }
}
