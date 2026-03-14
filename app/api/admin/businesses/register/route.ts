import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { sql } from '@/lib/db';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'secret');

export async function POST(request: NextRequest) {
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
      owner_id,
      name,
      slug,
      email,
      phone,
      description,
      logo_url,
      address,
      city,
      state,
      country,
      postal_code,
    } = await request.json();

    if (!owner_id || !name || !email) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const businessId = `business_${Date.now()}`;

    await sql.query(
      `INSERT INTO businesses 
        (id, owner_id, name, slug, email, phone, description, logo_url, address, city, state, country, postal_code, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())`,
      [
        businessId,
        owner_id,
        name,
        slug,
        email,
        phone || null,
        description || null,
        logo_url || null,
        address || null,
        city || null,
        state || null,
        country || null,
        postal_code || null,
        true,
      ]
    );

    const business = await sql.query(
      'SELECT * FROM businesses WHERE id = $1',
      [businessId]
    );

    return NextResponse.json({ business: business[0] }, { status: 201 });
  } catch (error) {
    console.error('Error registering business:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
