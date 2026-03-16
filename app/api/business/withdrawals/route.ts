import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getAll, query } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rows = await getAll(
      `SELECT * FROM withdrawals WHERE business_id IN 
       (SELECT id FROM businesses WHERE owner_id = $1)
       ORDER BY created_at DESC`,
      [currentUser.id]
    );

    return NextResponse.json(rows || []);
  } catch (error) {
    console.error('Failed to fetch withdrawals:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
