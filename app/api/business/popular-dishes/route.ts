import { NextRequest, NextResponse } from 'next/server';
import { getOne, getAll, query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { generateId } from '@/lib/utils-extended';

// GET - List all popular dishes for business
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

    // Get popular dishes
    const popularDishes = await getAll(
      `SELECT * FROM popular_dishes WHERE business_id = $1 ORDER BY display_order, created_at DESC`,
      [business.id]
    );

    return NextResponse.json({
      success: true,
      popularDishes,
    });
  } catch (error) {
    console.error('[v0] Get popular dishes error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch popular dishes' },
      { status: 500 }
    );
  }
}

// POST - Create popular dish
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const { combinationName, description, featuredImageUrl } = await request.json();

    if (!combinationName) {
      return NextResponse.json(
        { error: 'Combination name required' },
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

    // Create popular dish
    const dishId = generateId('pd');

    await query(
      `INSERT INTO popular_dishes (id, business_id, combination_name, description, featured_image_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [dishId, business.id, combinationName, description || null, featuredImageUrl || null]
    );

    const newDish = await getOne(
      'SELECT * FROM popular_dishes WHERE id = $1',
      [dishId]
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Popular dish created',
        popularDish: newDish,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Create popular dish error:', error);
    return NextResponse.json(
      { error: 'Failed to create popular dish' },
      { status: 500 }
    );
  }
}
