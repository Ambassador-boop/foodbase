import { NextRequest, NextResponse } from 'next/server';
import { getOne, getAll, query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { generateId } from '@/lib/utils-extended';

// GET - Get addon with options
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get addon details
    const addon = await getOne(
      'SELECT * FROM addons WHERE id = $1',
      [id]
    );

    if (!addon) {
      return NextResponse.json(
        { error: 'Add-on not found' },
        { status: 404 }
      );
    }

    // Get addon options
    const options = await getAll(
      'SELECT * FROM addon_options WHERE addon_id = $1 ORDER BY display_order, created_at',
      [id]
    );

    // Get paired menu items for this addon
    const pairedMenuItems = await getAll(
      'SELECT menu_item_id FROM menu_item_addons WHERE addon_id = $1',
      [id]
    );

    return NextResponse.json({
      success: true,
      addon: {
        ...addon,
        options: options || [],
        pairedMenuItems: pairedMenuItems?.map((m: any) => m.menu_item_id) || [],
      },
    });
  } catch (error) {
    console.error('[v0] Get addon error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch add-on' },
      { status: 500 }
    );
  }
}

// PATCH - Update add-on
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
    const { name, addonType, description, price, imageUrl, isRequired, allowMultiple, is_available, options, pairedMenuItems } = body;

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

    // Verify addon belongs to business
    const addon = await getOne(
      'SELECT * FROM addons WHERE id = $1 AND business_id = $2',
      [id, business.id]
    );

    if (!addon) {
      return NextResponse.json(
        { error: 'Add-on not found' },
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
    if (addonType !== undefined) {
      updates.push(`addon_type = $${paramCount++}`);
      values.push(addonType);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description || null);
    }
    if (price !== undefined) {
      updates.push(`price = $${paramCount++}`);
      values.push(price || 0);
    }
    if (imageUrl !== undefined) {
      updates.push(`image_url = $${paramCount++}`);
      values.push(imageUrl || null);
    }
    if (isRequired !== undefined) {
      updates.push(`is_required = $${paramCount++}`);
      values.push(isRequired);
    }
    if (allowMultiple !== undefined) {
      updates.push(`allow_multiple = $${paramCount++}`);
      values.push(allowMultiple);
    }
    if (is_available !== undefined) {
      updates.push(`is_available = $${paramCount++}`);
      values.push(is_available);
    }

    values.push(id);

    // Update addon
    await query(
      `UPDATE addons SET ${updates.join(', ')} WHERE id = $${paramCount}`,
      values
    );

    // Update options if provided
    if (Array.isArray(options) && options.length > 0) {
      // Delete existing options
      await query('DELETE FROM addon_options WHERE addon_id = $1', [id]);

      // Add new options
      for (const option of options) {
        const optionId = generateId('opt');
        await query(
          `INSERT INTO addon_options (id, addon_id, name, price, created_at, updated_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [optionId, id, option.name, option.price || 0]
        );
      }
    }

    // Update paired menu items if provided
    if (Array.isArray(pairedMenuItems)) {
      // Delete existing menu item relationships
      await query('DELETE FROM menu_item_addons WHERE addon_id = $1', [id]);

      // Add new relationships
      for (const menuItemId of pairedMenuItems) {
        // Verify menu item exists and belongs to business
        const menuItem = await getOne(
          'SELECT id FROM menu_items WHERE id = $1 AND business_id = $2',
          [menuItemId, business.id]
        );
        if (menuItem) {
          const relationId = generateId('rel');
          await query(
            `INSERT INTO menu_item_addons (id, menu_item_id, addon_id, is_required)
             VALUES ($1, $2, $3, $4)`,
            [relationId, menuItemId, id, false]
          );
        }
      }
    }

    const updated = await getOne(
      `SELECT a.*, 
              JSON_AGG(JSON_BUILD_OBJECT('id', ao.id, 'name', ao.name, 'price', ao.price)) 
              FILTER (WHERE ao.id IS NOT NULL) as options
       FROM addons a
       LEFT JOIN addon_options ao ON a.id = ao.addon_id
       WHERE a.id = $1
       GROUP BY a.id`,
      [id]
    );

    return NextResponse.json({
      success: true,
      message: 'Add-on updated',
      addon: updated,
    });
  } catch (error) {
    console.error('[v0] Update add-on error:', error);
    return NextResponse.json(
      { error: 'Failed to update add-on' },
      { status: 500 }
    );
  }
}

// DELETE - Delete add-on
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
    const addon = await getOne(
      'SELECT * FROM addons WHERE id = $1 AND business_id = $2',
      [id, business.id]
    );

    if (!addon) {
      return NextResponse.json(
        { error: 'Add-on not found' },
        { status: 404 }
      );
    }

    await query('DELETE FROM addons WHERE id = $1', [id]);

    return NextResponse.json({
      success: true,
      message: 'Add-on deleted',
    });
  } catch (error) {
    console.error('[v0] Delete add-on error:', error);
    return NextResponse.json(
      { error: 'Failed to delete add-on' },
      { status: 500 }
    );
  }
}
