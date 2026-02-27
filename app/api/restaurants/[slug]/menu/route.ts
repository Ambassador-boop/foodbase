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

    // Get menu items with their add-ons
    const menuItems = await getAll(
      `SELECT m.*, c.name as category_name,
              JSON_AGG(DISTINCT JSON_BUILD_OBJECT('id', a.id, 'name', a.name, 'addon_type', a.addon_type, 'is_required', mia.is_required, 'options', 
                JSON_AGG(JSON_BUILD_OBJECT('id', ao.id, 'name', ao.name, 'price', ao.price)) FILTER (WHERE ao.id IS NOT NULL)))
              FILTER (WHERE a.id IS NOT NULL) as addons
       FROM menu_items m
       LEFT JOIN categories c ON m.category_id = c.id
       LEFT JOIN menu_item_addons mia ON m.id = mia.menu_item_id
       LEFT JOIN addons a ON mia.addon_id = a.id
       LEFT JOIN addon_options ao ON a.id = ao.addon_id
       WHERE m.business_id = $1 AND m.is_available = true
       GROUP BY m.id, c.name
       ORDER BY m.display_order, m.created_at DESC`,
      [business.id]
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
      menuItems,
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
