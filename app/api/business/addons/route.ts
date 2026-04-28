import { NextRequest, NextResponse } from 'next/server';
import { getOne, getAll, query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getActiveBusiness } from '@/lib/active-business';
import { generateId } from '@/lib/utils-extended';

// GET - List add-ons for the active business
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

    const addons = await getAll(
      `SELECT a.*,
              JSON_AGG(JSON_BUILD_OBJECT(
                'id', ao.id,
                'name', ao.name,
                'price', ao.price,
                'display_order', ao.display_order
              )) FILTER (WHERE ao.id IS NOT NULL) as options
         FROM addons a
         LEFT JOIN addon_options ao ON a.id = ao.addon_id
        WHERE a.business_id = $1
        GROUP BY a.id
        ORDER BY a.display_order, a.created_at DESC`,
      [business.id],
    );

    return NextResponse.json({ success: true, addons });
  } catch (error) {
    console.error('[v0] Get add-ons error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch add-ons' },
      { status: 500 },
    );
  }
}

// POST - Create add-on
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const {
      name,
      addonType,
      description,
      price,
      imageUrl,
      isRequired,
      allowMultiple,
      options,
      pairedMenuItems,
    } = await request.json();

    if (!name || !addonType) {
      return NextResponse.json(
        { error: 'Name and addon type required' },
        { status: 400 },
      );
    }

    const business = await getActiveBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const addonId = generateId('add');
    await query(
      `INSERT INTO addons
        (id, business_id, name, addon_type, description, price, image_url,
         is_required, allow_multiple, is_available, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      [
        addonId,
        business.id,
        name,
        addonType,
        description || null,
        price || 0,
        imageUrl || null,
        isRequired || false,
        allowMultiple !== false,
        true,
      ],
    );

    if (Array.isArray(options) && options.length > 0) {
      for (const option of options) {
        const optionId = generateId('opt');
        await query(
          `INSERT INTO addon_options
            (id, addon_id, name, price, created_at, updated_at)
           VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [optionId, addonId, option.name, option.price || 0],
        );
      }
    }

    if (Array.isArray(pairedMenuItems) && pairedMenuItems.length > 0) {
      for (const menuItemId of pairedMenuItems) {
        const menuItem = await getOne(
          'SELECT id FROM menu_items WHERE id = $1 AND business_id = $2',
          [menuItemId, business.id],
        );
        if (menuItem) {
          const relationId = generateId('rel');
          await query(
            `INSERT INTO menu_item_addons
              (id, menu_item_id, addon_id, is_required)
             VALUES ($1, $2, $3, $4)`,
            [relationId, menuItemId, addonId, false],
          );
        }
      }
    }

    const newAddon = await getOne(
      `SELECT a.*,
              JSON_AGG(JSON_BUILD_OBJECT('id', ao.id, 'name', ao.name, 'price', ao.price))
              FILTER (WHERE ao.id IS NOT NULL) as options
         FROM addons a
         LEFT JOIN addon_options ao ON a.id = ao.addon_id
        WHERE a.id = $1
        GROUP BY a.id`,
      [addonId],
    );

    return NextResponse.json(
      { success: true, message: 'Add-on created', addon: newAddon },
      { status: 201 },
    );
  } catch (error) {
    console.error('[v0] Create add-on error:', error);
    return NextResponse.json(
      { error: 'Failed to create add-on' },
      { status: 500 },
    );
  }
}
