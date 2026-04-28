import { NextRequest, NextResponse } from 'next/server';
import { getOne, query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getActiveBusiness } from '@/lib/active-business';

// GET - Get a single drink belonging to the active business
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

    const drink = await getOne(
      'SELECT * FROM drinks WHERE id = $1 AND business_id = $2',
      [id, business.id],
    );
    if (!drink) {
      return NextResponse.json({ error: 'Drink not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, drink });
  } catch (error) {
    console.error('[v0] Get drink error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drink' },
      { status: 500 },
    );
  }
}

// PATCH - Update drink
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
    const { name, description, price, imageUrl, is_available } = body;

    const business = await getActiveBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const drink = await getOne(
      'SELECT * FROM drinks WHERE id = $1 AND business_id = $2',
      [id, business.id],
    );
    if (!drink) {
      return NextResponse.json({ error: 'Drink not found' }, { status: 404 });
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
      values.push(description || null);
    }
    if (price !== undefined) {
      updates.push(`price = $${paramCount++}`);
      values.push(price);
    }
    if (imageUrl !== undefined) {
      updates.push(`image_url = $${paramCount++}`);
      values.push(imageUrl || null);
    }
    if (is_available !== undefined) {
      updates.push(`is_available = $${paramCount++}`);
      values.push(is_available);
    }

    values.push(id);

    await query(
      `UPDATE drinks SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values,
    );

    const updated = await getOne('SELECT * FROM drinks WHERE id = $1', [id]);

    return NextResponse.json({
      success: true,
      message: 'Drink updated',
      drink: updated,
    });
  } catch (error) {
    console.error('[v0] Update drink error:', error);
    return NextResponse.json(
      { error: 'Failed to update drink' },
      { status: 500 },
    );
  }
}

// DELETE - Delete drink
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

    const drink = await getOne(
      'SELECT * FROM drinks WHERE id = $1 AND business_id = $2',
      [id, business.id],
    );
    if (!drink) {
      return NextResponse.json({ error: 'Drink not found' }, { status: 404 });
    }

    await query('DELETE FROM drinks WHERE id = $1', [id]);

    return NextResponse.json({ success: true, message: 'Drink deleted' });
  } catch (error) {
    console.error('[v0] Delete drink error:', error);
    return NextResponse.json(
      { error: 'Failed to delete drink' },
      { status: 500 },
    );
  }
}
