import { NextRequest, NextResponse } from 'next/server';
import { getOne, getAll, query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { getActiveBusiness } from '@/lib/active-business';
import { generateId } from '@/lib/utils-extended';

// GET - List all drinks for the active business
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

    const drinks = await getAll(
      `SELECT * FROM drinks
        WHERE business_id = $1
        ORDER BY display_order, created_at DESC`,
      [business.id],
    );

    return NextResponse.json({ success: true, drinks });
  } catch (error) {
    console.error('[v0] Get drinks error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch drinks' },
      { status: 500 },
    );
  }
}

// POST - Create drink
export async function POST(request: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { name, description, price, imageUrl } = await request.json();

    if (!name || price === undefined) {
      return NextResponse.json(
        { error: 'Name and price required' },
        { status: 400 },
      );
    }

    const business = await getActiveBusiness();
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const drinkId = generateId('drk');
    await query(
      `INSERT INTO drinks
        (id, business_id, name, description, price, image_url, is_available,
         created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      [drinkId, business.id, name, description || null, price, imageUrl || null, true],
    );

    const newDrink = await getOne('SELECT * FROM drinks WHERE id = $1', [
      drinkId,
    ]);

    return NextResponse.json(
      { success: true, message: 'Drink created', drink: newDrink },
      { status: 201 },
    );
  } catch (error) {
    console.error('[v0] Create drink error:', error);
    return NextResponse.json(
      { error: 'Failed to create drink' },
      { status: 500 },
    );
  }
}
