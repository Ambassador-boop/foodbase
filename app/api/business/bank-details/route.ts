import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getAuthCookie } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    let token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      token = await getAuthCookie();
    }
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || user.role !== 'business_owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { rows } = await sql.query(
      'SELECT bank_account_number, bank_name, account_holder_name FROM businesses WHERE owner_id = $1',
      [user.id]
    );

    if (!rows.length) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Failed to fetch bank details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    let token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      token = await getAuthCookie();
    }
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || user.role !== 'business_owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { bank_name, bank_account_number, account_holder_name } = await req.json();

    if (!bank_name || !bank_account_number || !account_holder_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { rows } = await sql.query(
      `UPDATE businesses 
       SET bank_name = $1, bank_account_number = $2, account_holder_name = $3
       WHERE owner_id = $4
       RETURNING id`,
      [bank_name, bank_account_number, account_holder_name, user.id]
    );

    if (!rows.length) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    return NextResponse.json({ message: 'Bank details updated' });
  } catch (error) {
    console.error('Failed to update bank details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
