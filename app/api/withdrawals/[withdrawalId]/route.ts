import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ withdrawalId: string }> }
) {
  try {
    const authCookie = request.cookies.get('auth_token')?.value;

    if (!authCookie) {
      return NextResponse.json({ error: 'No auth token found' }, { status: 401 });
    }

    const user = await verifyJWT(authCookie);

    if (!user) {
      return NextResponse.json({ error: 'Invalid auth token' }, { status: 401 });
    }

    const userId = (user as any).userId || (user as any).id;
    const resolvedParams = await params;
    const withdrawalId = resolvedParams.withdrawalId;

    // Get withdrawal details and verify ownership
    const result = await db.query(
      `SELECT 
        w.id,
        w.amount,
        w.service_fee,
        w.status,
        w.failure_reason,
        w.created_at,
        w.updated_at,
        tr.account_number as bank_account_number
       FROM withdrawals w
       LEFT JOIN transfer_recipients tr ON w.transfer_recipient_id = tr.id
       JOIN businesses b ON w.business_id = b.id
       WHERE w.id = $1 AND b.owner_id = $2`,
      [withdrawalId, userId]
    );

    if (!result || result.length === 0) {
      return NextResponse.json(
        { error: 'Withdrawal not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('[v0] Get withdrawal error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch withdrawal details' },
      { status: 500 }
    );
  }
}
