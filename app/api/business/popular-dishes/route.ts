import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { nanoid } from 'nanoid';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || user.role !== 'business_owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get popular dishes (either manually featured or automatically calculated)
    const { rows } = await sql.query(
      `SELECT pd.*, mi.name, mi.image_url, COUNT(oid.id) as order_count
       FROM popular_dishes pd
       LEFT JOIN menu_items mi ON pd.menu_item_id = mi.id
       LEFT JOIN order_items oid ON oid.menu_item_id = mi.id
       WHERE pd.business_id IN (SELECT id FROM businesses WHERE owner_id = $1)
       GROUP BY pd.id, mi.id
       ORDER BY order_count DESC, pd.created_at DESC`,
      [user.id]
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Failed to fetch popular dishes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || user.role !== 'business_owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { menu_item_id, featured_image_url, is_combo } = await req.json();

    if (!menu_item_id) {
      return NextResponse.json({ error: 'Menu item ID required' }, { status: 400 });
    }

    // Verify the menu item belongs to the business owner
    const menuCheck = await sql.query(
      `SELECT mi.id FROM menu_items mi
       JOIN businesses b ON mi.business_id = b.id
       WHERE mi.id = $1 AND b.owner_id = $2`,
      [menu_item_id, user.id]
    );

    if (!menuCheck.rows.length) {
      return NextResponse.json({ error: 'Menu item not found' }, { status: 404 });
    }

    const dishId = `pd_${nanoid(12)}`;
    const businessId = menuCheck.rows[0].business_id;

    const { rows } = await sql.query(
      `INSERT INTO popular_dishes (id, business_id, menu_item_id, featured_image_url, is_combo, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [dishId, businessId, menu_item_id, featured_image_url, is_combo || false]
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error('Failed to create popular dish:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
