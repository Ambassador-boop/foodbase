import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const token = await getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await verifyToken(token);
    const role = verified?.role as string;

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { businessId } = await params;
    const business = await sql.query(
      'SELECT * FROM businesses WHERE id = $1',
      [businessId]
    );

    if (!business || business.length === 0) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    return NextResponse.json({ business: business[0] });
  } catch (error) {
    console.error('Error fetching business:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const token = await getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await verifyToken(token);
    const role = verified?.role as string;

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const {
      name,
      email,
      phone,
      description,
      logo_url,
      address,
      city,
      state,
      country,
      postal_code,
      is_active,
    } = await request.json();

    const { businessId } = await params;
    await sql.query(
      `UPDATE businesses SET 
        name = $1, email = $2, phone = $3, description = $4, 
        logo_url = $5, address = $6, city = $7, state = $8, 
        country = $9, postal_code = $10, is_active = $11, 
        updated_at = NOW() 
      WHERE id = $12`,
      [
        name,
        email,
        phone || null,
        description || null,
        logo_url || null,
        address || null,
        city || null,
        state || null,
        country || null,
        postal_code || null,
        is_active,
        businessId,
      ]
    );

    const business = await sql.query(
      'SELECT * FROM businesses WHERE id = $1',
      [businessId]
    );

    return NextResponse.json({ business: business[0] });
  } catch (error) {
    console.error('Error updating business:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const token = await getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await verifyToken(token);
    const role = verified?.role as string;

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { businessId } = await params;
    await sql.query('DELETE FROM businesses WHERE id = $1', [businessId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting business:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
