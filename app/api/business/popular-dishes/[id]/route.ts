import { NextRequest, NextResponse } from 'next/server';
import { getOne, query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

// PATCH - Update popular dish
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
    const { combinationName, description, featuredImageUrl } = body;

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

    // Verify popular dish belongs to business
    const dish = await getOne(
      'SELECT * FROM popular_dishes WHERE id = $1 AND business_id = $2',
      [id, business.id]
    );

    if (!dish) {
      return NextResponse.json(
        { error: 'Popular dish not found' },
        { status: 404 }
      );
    }

    // Build update query dynamically
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
    if (featuredImageUrl !== undefined) {
      updates.push(`featured_image_url = $${paramCount++}`);
      values.push(featuredImageUrl || null);
    }

    values.push(id);

    await query(
      `UPDATE popular_dishes SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    const updated = await getOne(
      'SELECT * FROM popular_dishes WHERE id = $1',
      [id]
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
      { status: 500 }
    );
  }
}

// DELETE - Delete popular dish
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
    const dish = await getOne(
      'SELECT * FROM popular_dishes WHERE id = $1 AND business_id = $2',
      [id, business.id]
    );

    if (!dish) {
      return NextResponse.json(
        { error: 'Popular dish not found' },
        { status: 404 }
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
      { status: 500 }
    );
  }
}
