import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
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

/**
 * GET /api/kudi-sms/logs
 * Returns KudiSMS send logs for the current business
 * Requires authentication
 */
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

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);
    const offset = parseInt(searchParams.get('offset') || '0');
    const purpose = searchParams.get('purpose'); // Optional filter

    let whereClause = 'WHERE business_id = $1';
    const params: any[] = [business.id];

    if (purpose && ['bank_account', 'withdrawal'].includes(purpose)) {
      whereClause += ' AND purpose = $2';
      params.push(purpose);
    }

    const logs = await query(
      `SELECT 
        id,
        phone_number,
        message,
        purpose,
        kudi_message_id,
        status,
        error_code,
        error_message,
        created_at
      FROM kudi_sms_logs
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );

    const countResult = await query(
      `SELECT COUNT(*) as count FROM kudi_sms_logs ${whereClause}`,
      params
    );

    return NextResponse.json({
      logs,
      total: countResult[0]?.count || 0,
      limit,
      offset,
      hasMore: (offset + limit) < (countResult[0]?.count || 0),
    });
  } catch (error) {
    console.error('[v0] Failed to fetch SMS logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}
