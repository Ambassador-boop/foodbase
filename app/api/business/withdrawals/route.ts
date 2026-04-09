import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getAuthCookie } from '@/lib/auth';
import { nanoid } from 'nanoid';

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
      `SELECT * FROM withdrawals WHERE business_id IN 
       (SELECT id FROM businesses WHERE owner_id = $1)
       ORDER BY created_at DESC`,
      [user.id]
    );

    return NextResponse.json(rows);
  } catch (error) {
    console.error('Failed to fetch withdrawals:', error);
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

    const { amount } = await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    // Get business
    const businessResult = await sql.query(
      'SELECT id, available_balance FROM businesses WHERE owner_id = $1',
      [user.id]
    );

    if (!businessResult.rows.length) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const business = businessResult.rows[0];

    if (business.available_balance < amount) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Create withdrawal request
    const withdrawalId = `wd_${nanoid(12)}`;
    const { rows } = await sql.query(
      `INSERT INTO withdrawals (id, business_id, amount, status, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING *`,
      [withdrawalId, business.id, amount, 'pending']
    );

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error) {
    console.error('Failed to create withdrawal:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
