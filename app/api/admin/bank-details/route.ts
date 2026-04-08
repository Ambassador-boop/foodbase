import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
