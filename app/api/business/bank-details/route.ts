import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    let token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      token = req.cookies.get('auth_token')?.value;
    }
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { rows } = await sql.query(
      'SELECT bank_account_number, bank_code, bank_account_holder FROM businesses WHERE owner_id = $1',
      [payload.userId]
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
      token = req.cookies.get('auth_token')?.value;
    }
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { bank_code, bank_account_number, bank_account_holder } = await req.json();

    if (!bank_code || !bank_account_number || !bank_account_holder) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { rows } = await sql.query(
      `UPDATE businesses 
       SET bank_code = $1, bank_account_number = $2, bank_account_holder = $3
       WHERE owner_id = $4
       RETURNING id`,
      [bank_code, bank_account_number, bank_account_holder, payload.userId]
    );

    if (!rows.length) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    return NextResponse.json({ message: 'Bank details updated' });
  } catch (error) {
    console.error('Failed to update bank details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
