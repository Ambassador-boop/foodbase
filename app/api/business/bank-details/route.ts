import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { getActiveBusinessForUser } from '@/lib/active-business';

async function getUserId(req: NextRequest) {
  let token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) token = req.cookies.get('auth_token')?.value;
  if (!token) return null;
  const payload = await verifyJWT(token);
  if (!payload) return null;
  return (payload as any).userId || (payload as any).id;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await getActiveBusinessForUser(userId);
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const { rows } = await sql.query(
      `SELECT bank_account_number, bank_code, bank_account_holder
         FROM businesses
        WHERE id = $1`,
      [business.id],
    );

    if (!rows.length) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 },
      );
    }
    return NextResponse.json(rows[0]);
  } catch (error) {
    console.error('Failed to fetch bank details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const business = await getActiveBusinessForUser(userId);
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const { bank_code, bank_account_number, bank_account_holder } =
      await req.json();

    if (!bank_code || !bank_account_number || !bank_account_holder) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 },
      );
    }

    const { rows } = await sql.query(
      `UPDATE businesses
          SET bank_code = $1,
              bank_account_number = $2,
              bank_account_holder = $3
        WHERE id = $4
        RETURNING id`,
      [bank_code, bank_account_number, bank_account_holder, business.id],
    );

    if (!rows.length) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 },
      );
    }
    return NextResponse.json({ message: 'Bank details updated' });
  } catch (error) {
    console.error('Failed to update bank details:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
