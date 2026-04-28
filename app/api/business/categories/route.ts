import { NextRequest, NextResponse } from 'next/server';
import { getOne, getAll, query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getActiveBusiness } from '@/lib/active-business';
import { generateId } from '@/lib/utils-extended';

// GET - List all categories for the active business
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

    const categories = await getAll(
      `SELECT *,
              (SELECT COUNT(*) FROM menu_items WHERE category_id = categories.id) AS item_count
         FROM categories
        WHERE business_id = $1
        ORDER BY display_order, created_at DESC`,
      [business.id],
    );

    return NextResponse.json({ success: true, categories });
  } catch (error) {
    console.error('[v0] Get categories error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 },
    );
  }
}

// POST - Create category
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { name, description } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const business = await getActiveBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const categoryId = generateId('cat');
    await query(
      `INSERT INTO categories
        (id, business_id, name, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [categoryId, business.id, name, description || null],
    );

    const newCategory = await getOne(
      'SELECT * FROM categories WHERE id = $1',
      [categoryId],
    );

    return NextResponse.json(
      { success: true, message: 'Category created', category: newCategory },
      { status: 201 },
    );
  } catch (error) {
    console.error('[v0] Create category error:', error);
    return NextResponse.json(
      { error: 'Failed to create category' },
      { status: 500 },
    );
  }
}

// PATCH - Update category
export async function PATCH(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { id, name, description } = await request.json();
    if (!id || !name) {
      return NextResponse.json(
        { error: 'id and name are required' },
        { status: 400 },
      );
    }

    const business = await getActiveBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const cat = await getOne(
      'SELECT id FROM categories WHERE id = $1 AND business_id = $2',
      [id, business.id],
    );
    if (!cat) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 },
      );
    }

    await query(
      `UPDATE categories
          SET name = $1,
              description = $2,
              updated_at = CURRENT_TIMESTAMP
        WHERE id = $3`,
      [name, description || null, id],
    );

    const updated = await getOne(
      'SELECT * FROM categories WHERE id = $1',
      [id],
    );

    return NextResponse.json({ success: true, category: updated });
  } catch (error) {
    console.error('[v0] Update category error:', error);
    return NextResponse.json(
      { error: 'Failed to update category' },
      { status: 500 },
    );
  }
}

// DELETE - Delete category
export async function DELETE(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const business = await getActiveBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const cat = await getOne(
      'SELECT id FROM categories WHERE id = $1 AND business_id = $2',
      [id, business.id],
    );
    if (!cat) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 },
      );
    }

    // Detach menu items so they don't break.
    await query(
      'UPDATE menu_items SET category_id = NULL WHERE category_id = $1',
      [id],
    );
    await query('DELETE FROM categories WHERE id = $1', [id]);

    return NextResponse.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    console.error('[v0] Delete category error:', error);
    return NextResponse.json(
      { error: 'Failed to delete category' },
      { status: 500 },
    );
  }
}
