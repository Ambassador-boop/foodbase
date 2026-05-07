import { NextRequest, NextResponse } from 'next/server';
import { getAll, query, getOne } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getActiveBusiness } from '@/lib/active-business';
import { generateId } from '@/lib/utils-extended';

// GET - List all menu items for the active business with filtering and sorting
export async function GET(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const business = await getActiveBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const sort = searchParams.get('sort') || 'display_order';
    const limit = parseInt(searchParams.get('limit') || '50');
    const timeRange = searchParams.get('timeRange') || 'today';

    // Get all menu items for this business
    const menuItems = await getAll(
      `SELECT m.*, c.name as category_name
         FROM menu_items m
         LEFT JOIN categories c ON m.category_id = c.id
        WHERE m.business_id = $1
        ORDER BY m.display_order, m.created_at DESC`,
      [business.id],
    );

    // Calculate order counts and total revenue for each menu item based on timeRange
    const itemsWithStats = await Promise.all(
      menuItems.map(async (item: any) => {
        let dateFilter = '';
        const dateParams: any[] = [item.id, business.id];
        
        if (timeRange === 'today') {
          dateFilter = ` AND DATE(oi.created_at) = CURRENT_DATE`;
        } else if (timeRange === 'week') {
          dateFilter = ` AND oi.created_at >= CURRENT_DATE - INTERVAL '7 days'`;
        } else if (timeRange === 'month') {
          dateFilter = ` AND oi.created_at >= CURRENT_DATE - INTERVAL '30 days'`;
        } else if (timeRange === 'last30') {
          dateFilter = ` AND oi.created_at >= CURRENT_DATE - INTERVAL '30 days'`;
        }

        try {
          const statsRow = await getOne(
            `SELECT 
               COUNT(oi.id) as order_count,
               COALESCE(SUM(oi.item_price * oi.quantity), 0) as total_revenue
             FROM order_items oi
             WHERE oi.menu_item_id = $1
             AND oi.id IN (
               SELECT oi2.id FROM order_items oi2
               JOIN orders o ON oi2.order_id = o.id
               WHERE o.business_id = $2
               ${dateFilter}
             )`,
            dateParams,
          );

          const stats = statsRow || { order_count: 0, total_revenue: 0 };

          return {
            id: item.id,
            name: item.name,
            imageUrl: item.image_url,
            orderCount: parseInt(stats.order_count || '0'),
            price: Number(item.price),
            totalRevenue: Number(stats.total_revenue) || 0,
            categoryName: item.category_name,
            description: item.description,
            isAvailable: item.is_available,
            discountType: item.discount_type,
            discountValue: item.discount_value,
          };
        } catch (err) {
          console.error('Error calculating stats for menu item:', item.id, err);
          return {
            id: item.id,
            name: item.name,
            imageUrl: item.image_url,
            orderCount: 0,
            price: Number(item.price),
            totalRevenue: 0,
            categoryName: item.category_name,
            description: item.description,
            isAvailable: item.is_available,
            discountType: item.discount_type,
            discountValue: item.discount_value,
          };
        }
      }),
    );

    // Sort the items based on the sort parameter
    let sortedItems = [...itemsWithStats];
    if (sort === 'order_count') {
      sortedItems.sort((a, b) => b.orderCount - a.orderCount);
    } else if (sort === 'revenue') {
      sortedItems.sort((a, b) => b.totalRevenue - a.totalRevenue);
    } else if (sort === 'name') {
      sortedItems.sort((a, b) => a.name.localeCompare(b.name));
    }

    // Apply limit
    const items = sortedItems.slice(0, limit);

    return NextResponse.json({ success: true, items });
  } catch (error) {
    console.error('[v0] Get menu items error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch menu items' },
      { status: 500 },
    );
  }
}

// POST - Create menu item against the active business
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const {
      name,
      description,
      price,
      originalPrice,
      categoryId,
      imageUrl,
      discountType,
      discountValue,
    } = await request.json();

    if (!name || originalPrice === undefined) {
      return NextResponse.json(
        { error: 'Name and original price required' },
        { status: 400 },
      );
    }

    const business = await getActiveBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const menuItemId = generateId('mnu');
    await query(
      `INSERT INTO menu_items
        (id, business_id, category_id, name, description, price, original_price,
         image_url, discount_type, discount_value, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      [
        menuItemId,
        business.id,
        categoryId || null,
        name,
        description,
        price,
        originalPrice || null,
        imageUrl || null,
        discountType || null,
        discountValue || null,
      ],
    );

    const newMenuItem = await getOne(
      'SELECT * FROM menu_items WHERE id = $1',
      [menuItemId],
    );

    return NextResponse.json(
      { success: true, message: 'Menu item created', menuItem: newMenuItem },
      { status: 201 },
    );
  } catch (error) {
    console.error('[v0] Create menu item error:', error);
    return NextResponse.json(
      { error: 'Failed to create menu item' },
      { status: 500 },
    );
  }
}
