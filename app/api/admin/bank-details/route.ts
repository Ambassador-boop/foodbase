import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      console.error('[v0] No token provided to admin bank-details GET');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let user;
    try {
      user = await verifyToken(token);
    } catch (tokenErr) {
      console.error('[v0] Token verification failed in admin bank-details:', tokenErr);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!user) {
      console.error('[v0] No user found from token in admin bank-details');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      console.error('[v0] User role is not admin in bank-details:', user.role);
      return NextResponse.json({ error: 'Forbidden - admin role required' }, { status: 403 });
    }

    const result = await sql`
      SELECT 
        id,
        bank_code,
        account_number,
        account_name,
        paystack_recipient_id,
        is_active,
        created_at
      FROM admin_bank_details
      WHERE is_active = TRUE
      LIMIT 1
    `;

    if (result.rows.length === 0) {
      return NextResponse.json(null);
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to fetch bank details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      console.error('[v0] No token provided to admin bank-details POST');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let user;
    try {
      user = await verifyToken(token);
    } catch (tokenErr) {
      console.error('[v0] Token verification failed in admin bank-details POST:', tokenErr);
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    if (!user) {
      console.error('[v0] No user found from token in admin bank-details POST');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      console.error('[v0] User role is not admin in bank-details POST:', user.role);
      return NextResponse.json({ error: 'Forbidden - admin role required' }, { status: 403 });
    }

    const { bank_code, account_number, account_name, paystack_recipient_id } = await req.json();

    if (!bank_code || !account_number || !account_name) {
      return NextResponse.json(
        { error: 'Missing required fields: bank_code, account_number, account_name' },
        { status: 400 }
      );
    }

    // Deactivate existing bank details
    await sql`UPDATE admin_bank_details SET is_active = FALSE`;

    // Insert new bank details
    const result = await sql`
      INSERT INTO admin_bank_details (bank_code, account_number, account_name, paystack_recipient_id, is_active)
      VALUES (${bank_code}, ${account_number}, ${account_name}, ${paystack_recipient_id || null}, TRUE)
      RETURNING id, bank_code, account_number, account_name, paystack_recipient_id, is_active
    `;

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('Failed to save bank details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
