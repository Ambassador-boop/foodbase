import { NextRequest, NextResponse } from 'next/server';
import { getOne, query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getActiveBusiness } from '@/lib/active-business';

// GET - Fetch a single menu item belonging to the active business
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await getCurrentUser();
    const { id } = await params;

    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const business = await getActiveBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const menuItem = await getOne(
      `SELECT m.*, c.name as category_name
         FROM menu_items m
         LEFT JOIN categories c ON m.category_id = c.id
        WHERE m.id = $1 AND m.business_id = $2`,
      [id, business.id],
    );

    if (!menuItem) {
      return NextResponse.json(
        { error: 'Menu item not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, menuItem });
  } catch (error) {
    console.error('[v0] Get menu item error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch menu item' },
      { status: 500 },
    );
  }
}

// PATCH - Update menu item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await getCurrentUser();
    const { id } = await params;

    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const {
      name,
      description,
      price,
      originalPrice,
      categoryId,
      imageUrl,
      is_available,
      discountType,
      discountValue,
    } = body;

    const business = await getActiveBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const menuItem = await getOne(
      'SELECT * FROM menu_items WHERE id = $1 AND business_id = $2',
      [id, business.id],
    );
    if (!menuItem) {
      return NextResponse.json(
        { error: 'Menu item not found' },
        { status: 404 },
      );
    }

    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const values: any[] = [];
    let paramCount = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (price !== undefined) {
      updates.push(`price = $${paramCount++}`);
      values.push(price);
    }
    if (categoryId !== undefined) {
      updates.push(`category_id = $${paramCount++}`);
      values.push(categoryId || null);
    }
    if (imageUrl !== undefined) {
      updates.push(`image_url = $${paramCount++}`);
      values.push(imageUrl || null);
    }
    if (is_available !== undefined) {
      updates.push(`is_available = $${paramCount++}`);
      values.push(is_available);
    }
    if (originalPrice !== undefined) {
      updates.push(`original_price = $${paramCount++}`);
      values.push(originalPrice || null);
    }
    if (discountType !== undefined) {
      updates.push(`discount_type = $${paramCount++}`);
      values.push(discountType || null);
    }
    if (discountValue !== undefined) {
      updates.push(`discount_value = $${paramCount++}`);
      values.push(discountValue || null);
    }

    values.push(id);

    await query(
      `UPDATE menu_items SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values,
    );

    const updated = await getOne(
      'SELECT * FROM menu_items WHERE id = $1',
      [id],
    );

    return NextResponse.json({
      success: true,
      message: 'Menu item updated',
      menuItem: updated,
    });
  } catch (error) {
    console.error('[v0] Update menu item error:', error);
    return NextResponse.json(
      { error: 'Failed to update menu item' },
      { status: 500 },
    );
  }
}

// DELETE - Delete menu item
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await getCurrentUser();
    const { id } = await params;

    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const business = await getActiveBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const menuItem = await getOne(
      'SELECT * FROM menu_items WHERE id = $1 AND business_id = $2',
      [id, business.id],
    );
    if (!menuItem) {
      return NextResponse.json(
        { error: 'Menu item not found' },
        { status: 404 },
      );
    }

    await query('DELETE FROM menu_items WHERE id = $1', [id]);

    return NextResponse.json({ success: true, message: 'Menu item deleted' });
  } catch (error) {
    console.error('[v0] Delete menu item error:', error);
    return NextResponse.json(
      { error: 'Failed to delete menu item' },
      { status: 500 },
    );
  }
}
