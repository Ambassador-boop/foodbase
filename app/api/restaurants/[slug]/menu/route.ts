import { NextRequest, NextResponse } from 'next/server';
import { getOne, getAll } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    console.log('[v0] API: Fetching menu for slug:', slug);

    // Get business by slug
    const business = await getOne(
      'SELECT * FROM businesses WHERE slug = $1 AND is_active = true',
      [slug]
    );

    console.log('[v0] API: Business lookup result:', business ? `Found ${business.name}` : 'Not found');

    if (!business) {
      console.log('[v0] API: No active business found for slug:', slug);
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
    console.log('[v0] API: Categories fetched:', categories.length);

    // Get menu items with their add-ons - simplified query without nested JSON aggregation
    const menuItems = await getAll(
      `SELECT m.id, m.name, m.description, m.price, m.original_price, m.image_url, m.is_available, 
              m.display_order, m.category_id, m.is_popular, m.order_count,
              m.discount_type, m.discount_value,
              c.name as category_name
       FROM menu_items m
       LEFT JOIN categories c ON m.category_id = c.id
       WHERE m.business_id = $1 AND m.is_available = true
       ORDER BY m.display_order, m.created_at DESC`,
      [business.id]
    );
    console.log('[v0] API: Menu items fetched:', menuItems.length);

    // Get addons for each menu item separately to avoid JSON query issues
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
          console.log(`[v0] API: Addons for menu item ${item.id}:`, addons?.length || 0);

          // Get options for each addon
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
        } catch (err) {
          // If addon query fails, just return item without addons
          console.error('[v0] Error fetching addons for menu item:', item.id, err);
          return { ...item, addons: [] };
        }
      })
    );

    // Get drinks
    const drinks = await getAll(
      'SELECT * FROM drinks WHERE business_id = $1 AND is_available = true ORDER BY display_order, created_at DESC',
      [business.id]
    );
    console.log('[v0] API: Drinks fetched:', drinks.length);

    // Get popular dishes
    const popularDishes = await getAll(
      'SELECT * FROM popular_dishes WHERE business_id = $1 ORDER BY display_order, created_at DESC LIMIT 5',
      [business.id]
    );
    console.log('[v0] API: Popular dishes fetched:', popularDishes.length);

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
      },
      categories,
      menuItems: menuItemsWithAddons,
      drinks,
      popularDishes,
    };
    
    console.log('[v0] API: Returning successful response');
    return NextResponse.json(response);
  } catch (error) {
    console.error('[v0] Get menu error:', error);
    console.error('[v0] Error details:', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json(
      { error: 'Failed to fetch menu', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
