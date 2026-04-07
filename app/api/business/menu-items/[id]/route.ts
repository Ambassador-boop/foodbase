import { NextRequest, NextResponse } from 'next/server';
import { getOne, query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// PATCH - Update menu item
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    const { id } = await params;

    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description, price, categoryId, imageUrl, is_available, discountType, discountValue, discountedPrice } = body;

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

    // Verify menu item belongs to business
    const menuItem = await getOne(
      'SELECT * FROM menu_items WHERE id = $1 AND business_id = $2',
      [id, business.id]
    );

    if (!menuItem) {
      return NextResponse.json(
        { error: 'Menu item not found' },
        { status: 404 }
      );
    }

    // Build update query dynamically
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
    if (discountType !== undefined) {
      updates.push(`discount_type = $${paramCount++}`);
      values.push(discountType || null);
    }
    if (discountValue !== undefined) {
      updates.push(`discount_value = $${paramCount++}`);
      values.push(discountValue || null);
    }
    if (discountedPrice !== undefined) {
      updates.push(`discounted_price = $${paramCount++}`);
      values.push(discountedPrice || null);
    }

    values.push(id);

    await query(
      `UPDATE menu_items SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    const updated = await getOne(
      'SELECT * FROM menu_items WHERE id = $1',
      [id]
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
      { status: 500 }
    );
  }
}

// DELETE - Delete menu item
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();
    const { id } = await params;

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

    // Verify and delete
    const menuItem = await getOne(
      'SELECT * FROM menu_items WHERE id = $1 AND business_id = $2',
      [id, business.id]
    );

    if (!menuItem) {
      return NextResponse.json(
        { error: 'Menu item not found' },
        { status: 404 }
      );
    }

    await query('DELETE FROM menu_items WHERE id = $1', [id]);

    return NextResponse.json({
      success: true,
      message: 'Menu item deleted',
    });
  } catch (error) {
    console.error('[v0] Delete menu item error:', error);
    return NextResponse.json(
      { error: 'Failed to delete menu item' },
      { status: 500 }
    );
  }
}
