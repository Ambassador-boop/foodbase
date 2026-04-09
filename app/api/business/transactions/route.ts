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

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'income', 'withdrawal', 'refund'
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = `
      SELECT t.*, b.name as business_name
      FROM transactions t
      JOIN businesses b ON t.business_id = b.id
      WHERE b.owner_id = $1
    `;
    const params: any[] = [user.id];

    if (type) {
      query += ` AND t.type = $${params.length + 1}`;
      params.push(type);
    }

    if (startDate) {
      query += ` AND t.created_at >= $${params.length + 1}`;
      params.push(startDate);
    }

    if (endDate) {
      query += ` AND t.created_at <= $${params.length + 1}`;
      params.push(endDate);
    }

    query += ` ORDER BY t.created_at DESC`;

    const { rows } = await sql.query(query, params);
    return NextResponse.json(rows);
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
