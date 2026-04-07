import { NextRequest, NextResponse } from 'next/server';
import { getOne, getAll, query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { generateId } from '@/lib/utils-extended';

// GET - List all menu items for business
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Get business
    const business = await getOne(
      'SELECT id FROM businesses WHERE owner_id = $1',
      [currentUser.id]
    );

    if (!business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    // Get menu items with category info
    const menuItems = await getAll(
      `SELECT m.*, c.name as category_name
       FROM menu_items m
       LEFT JOIN categories c ON m.category_id = c.id
       WHERE m.business_id = $1
       ORDER BY m.display_order, m.created_at DESC`,
      [business.id]
    );

    return NextResponse.json({
      success: true,
      menuItems,
    });
  } catch (error) {
    console.error('[v0] Get menu items error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch menu items' },
      { status: 500 }
    );
  }
}

// POST - Create menu item
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const { name, description, price, originalPrice, categoryId, imageUrl, discountType, discountValue } = await request.json();

    if (!name || originalPrice === undefined) {
      return NextResponse.json(
        { error: 'Name and original price required' },
        { status: 400 }
      );
    }

    // Get business
    const business = await getOne(
      'SELECT id FROM businesses WHERE owner_id = $1',
      [currentUser.id]
    );

    if (!business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    // Create menu item
    const menuItemId = generateId('mnu');

    await query(
      `INSERT INTO menu_items (id, business_id, category_id, name, description, price, original_price, image_url, discount_type, discount_value, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [menuItemId, business.id, categoryId || null, name, description, price, originalPrice || null, imageUrl || null, discountType || null, discountValue || null]
    );

    const newMenuItem = await getOne(
      'SELECT * FROM menu_items WHERE id = $1',
      [menuItemId]
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Menu item created',
        menuItem: newMenuItem,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Create menu item error:', error);
    return NextResponse.json(
      { error: 'Failed to create menu item' },
      { status: 500 }
    );
  }
}
