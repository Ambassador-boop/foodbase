import { NextRequest, NextResponse } from 'next/server';
import { getOne, getAll, query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { generateId } from '@/lib/utils-extended';

// GET - List all categories
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

    const categories = await getAll(
      'SELECT * FROM categories WHERE business_id = $1 ORDER BY display_order, created_at DESC',
      [business.id]
    );

    return NextResponse.json({
      success: true,
      categories,
    });
  } catch (error) {
    console.error('[v0] Get categories error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}

// POST - Create category
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const { name, description } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
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

    const categoryId = generateId('cat');

    await query(
      `INSERT INTO categories (id, business_id, name, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [categoryId, business.id, name, description || null]
    );

    const newCategory = await getOne(
      'SELECT * FROM categories WHERE id = $1',
      [categoryId]
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Category created',
        category: newCategory,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Create category error:', error);
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 }
    );
  }
}
