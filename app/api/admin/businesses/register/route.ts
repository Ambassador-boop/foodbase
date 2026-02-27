import { NextRequest, NextResponse } from 'next/server';
import { query, getOne } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { generateId, generateSlug } from '@/lib/utils-extended';
import { hashPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const currentUser = await getCurrentUser();

    if (!currentUser || currentUser.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    const {
      businessName,
      businessEmail,
      ownerFirstName,
      ownerLastName,
      ownerEmail,
      ownerPhone,
      businessPhone,
      businessAddress,
      businessCity,
      businessState,
      businessCountry,
      businessPostalCode,
      logoUrl,
      ownerPassword,
    } = await request.json();

    // Validate required fields
    if (!businessName || !ownerFirstName || !ownerLastName || !ownerEmail || !ownerPassword) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (ownerPassword.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      );
    }

    // Check if owner email already exists
    const existingUser = await getOne(
      'SELECT id FROM users WHERE email = $1',
      [ownerEmail]
    );

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email already registered' },
        { status: 400 }
      );
    }

    // Create user record
    const userId = generateId('usr');
    const passwordHash = await hashPassword(ownerPassword);

    await query(
      `INSERT INTO users (id, email, password_hash, role, first_name, last_name, phone, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [userId, ownerEmail, passwordHash, 'business_owner', ownerFirstName, ownerLastName, ownerPhone]
    );

    // Create business record
    const businessId = generateId('bus');
    const slug = generateSlug(businessName);

    await query(
      `INSERT INTO businesses (id, owner_id, name, slug, email, phone, address, city, state, country, postal_code, logo_url, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        businessId,
        userId,
        businessName,
        slug,
        businessEmail || ownerEmail,
        businessPhone,
        businessAddress,
        businessCity,
        businessState,
        businessCountry,
        businessPostalCode,
        logoUrl,
      ]
    );

    return NextResponse.json(
      {
        success: true,
        message: 'Business registered successfully',
        business: {
          id: businessId,
          name: businessName,
          slug,
          owner: {
            id: userId,
            email: ownerEmail,
            name: `${ownerFirstName} ${ownerLastName}`,
          },
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[v0] Business registration error:', error);
    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}
