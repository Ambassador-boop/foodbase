import { NextRequest, NextResponse } from 'next/server';
import { getOne, getAll, query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getActiveBusiness } from '@/lib/active-business';
import { generateId } from '@/lib/utils-extended';

// GET - List popular dishes for the active business
export async function GET(_request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const business = await getActiveBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const popularDishes = await getAll(
      `SELECT * FROM popular_dishes
        WHERE business_id = $1
        ORDER BY display_order, created_at DESC`,
      [business.id],
    );

    return NextResponse.json({ success: true, popularDishes });
  } catch (error) {
    console.error('[v0] Get popular dishes error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch popular dishes' },
      { status: 500 },
    );
  }
}

// POST - Create popular dish (full schema: price, discount, etc.)
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const {
      combinationName,
      description,
      tagline,
      featuredImageUrl,
      price,
      originalPrice,
      discountType,
      discountValue,
      isAvailable,
      menuItemIds,
    } = await request.json();

    if (!combinationName) {
      return NextResponse.json(
        { error: 'Combination name required' },
        { status: 400 },
      );
    }

    const business = await getActiveBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const dishId = generateId('pd');
    await query(
      `INSERT INTO popular_dishes
        (id, business_id, combination_name, description, tagline,
         featured_image_url, price, original_price, discount_type,
         discount_value, is_available, is_manual, menu_item_ids,
         created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,
               CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      [
        dishId,
        business.id,
        combinationName,
        description || null,
        tagline || null,
        featuredImageUrl || null,
        price ?? null,
        originalPrice ?? null,
        discountType || null,
        discountValue ?? null,
        isAvailable !== false,
        true,
        Array.isArray(menuItemIds) ? menuItemIds.join(',') : null,
      ],
    );

    const newDish = await getOne(
      'SELECT * FROM popular_dishes WHERE id = $1',
      [dishId],
    );

    return NextResponse.json(
      { success: true, message: 'Popular dish created', popularDish: newDish },
      { status: 201 },
    );
  } catch (error) {
    console.error('[v0] Create popular dish error:', error);
    return NextResponse.json(
      { error: 'Failed to create popular dish' },
      { status: 500 },
    );
  }
}
