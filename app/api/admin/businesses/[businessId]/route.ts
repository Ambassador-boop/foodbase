import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'secret');

export async function GET(
  request: NextRequest,
  { params }: { params: { businessId: string } }
) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await jwtVerify(token, secret);
    const role = verified.payload.role as string;

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const business = await db(
      'SELECT * FROM businesses WHERE id = $1',
      [params.businessId]
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
  { params }: { params: { businessId: string } }
) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await jwtVerify(token, secret);
    const role = verified.payload.role as string;

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

    await db(
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
        params.businessId,
      ]
    );

    const business = await db(
      'SELECT * FROM businesses WHERE id = $1',
      [params.businessId]
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
  { params }: { params: { businessId: string } }
) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await jwtVerify(token, secret);
    const role = verified.payload.role as string;

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db('DELETE FROM businesses WHERE id = $1', [params.businessId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting business:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
