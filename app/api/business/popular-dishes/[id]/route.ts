import { NextRequest, NextResponse } from 'next/server';
import { getOne, query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getActiveBusiness } from '@/lib/active-business';

// GET - Fetch a single popular dish belonging to the active business
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

    const dish = await getOne(
      'SELECT * FROM popular_dishes WHERE id = $1 AND business_id = $2',
      [id, business.id],
    );
    if (!dish) {
      return NextResponse.json(
        { error: 'Popular dish not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, popularDish: dish });
  } catch (error) {
    console.error('[v0] Get popular dish error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch popular dish' },
      { status: 500 },
    );
  }
}

// PATCH - Update popular dish
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
    } = body;

    const business = await getActiveBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const dish = await getOne(
      'SELECT * FROM popular_dishes WHERE id = $1 AND business_id = $2',
      [id, business.id],
    );
    if (!dish) {
      return NextResponse.json(
        { error: 'Popular dish not found' },
        { status: 404 },
      );
    }

    const updates: string[] = ['updated_at = CURRENT_TIMESTAMP'];
    const values: any[] = [];
    let paramCount = 1;

    if (combinationName !== undefined) {
      updates.push(`combination_name = $${paramCount++}`);
      values.push(combinationName);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description || null);
    }
    if (tagline !== undefined) {
      updates.push(`tagline = $${paramCount++}`);
      values.push(tagline || null);
    }
    if (featuredImageUrl !== undefined) {
      updates.push(`featured_image_url = $${paramCount++}`);
      values.push(featuredImageUrl || null);
    }
    if (price !== undefined) {
      updates.push(`price = $${paramCount++}`);
      values.push(price ?? null);
    }
    if (originalPrice !== undefined) {
      updates.push(`original_price = $${paramCount++}`);
      values.push(originalPrice ?? null);
    }
    if (discountType !== undefined) {
      updates.push(`discount_type = $${paramCount++}`);
      values.push(discountType || null);
    }
    if (discountValue !== undefined) {
      updates.push(`discount_value = $${paramCount++}`);
      values.push(discountValue ?? null);
    }
    if (isAvailable !== undefined) {
      updates.push(`is_available = $${paramCount++}`);
      values.push(isAvailable);
    }
    if (menuItemIds !== undefined) {
      updates.push(`menu_item_ids = $${paramCount++}`);
      values.push(
        Array.isArray(menuItemIds) ? menuItemIds.join(',') : menuItemIds || null,
      );
    }

    values.push(id);

    await query(
      `UPDATE popular_dishes SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values,
    );

    const updated = await getOne(
      'SELECT * FROM popular_dishes WHERE id = $1',
      [id],
    );

    return NextResponse.json({
      success: true,
      message: 'Popular dish updated',
      popularDish: updated,
    });
  } catch (error) {
    console.error('[v0] Update popular dish error:', error);
    return NextResponse.json(
      { error: 'Failed to update popular dish' },
      { status: 500 },
    );
  }
}

// DELETE - Delete popular dish
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

    const dish = await getOne(
      'SELECT * FROM popular_dishes WHERE id = $1 AND business_id = $2',
      [id, business.id],
    );
    if (!dish) {
      return NextResponse.json(
        { error: 'Popular dish not found' },
        { status: 404 },
      );
    }

    await query('DELETE FROM popular_dishes WHERE id = $1', [id]);

    return NextResponse.json({
      success: true,
      message: 'Popular dish deleted',
    });
  } catch (error) {
    console.error('[v0] Delete popular dish error:', error);
    return NextResponse.json(
      { error: 'Failed to delete popular dish' },
      { status: 500 },
    );
  }
}
