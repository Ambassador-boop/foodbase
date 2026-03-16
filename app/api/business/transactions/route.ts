import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAll } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');

    let query = `
      SELECT t.*, b.name as business_name
      FROM transactions t
      JOIN businesses b ON t.business_id = b.id
      WHERE b.owner_id = $1
    `;
    const params: any[] = [currentUser.id];

    if (type) {
      query += ` AND t.type = $${params.length + 1}`;
      params.push(type);
    }

    query += ` ORDER BY t.created_at DESC`;

    const rows = await getAll(query, params);
    return NextResponse.json(rows || []);
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
