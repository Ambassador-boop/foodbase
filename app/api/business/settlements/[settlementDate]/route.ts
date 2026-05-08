import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { getActiveBusinessForUser } from '@/lib/active-business';

/**
 * Returns all transactions settled on a specific date for the authenticated
 * user's active business, including refund impact information.
 *
 * Parameter: settlementDate - ISO date string (YYYY-MM-DD)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ settlementDate: string }> },
) {
  try {
    const { settlementDate } = await params;

    const token =
      request.headers.get('authorization')?.replace('Bearer ', '') ||
      request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyJWT(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const userId = (payload as any).userId || (payload as any).id;

    // Get the active business
    const activeBusiness = await getActiveBusinessForUser(userId);
    if (!activeBusiness) {
      return NextResponse.json(
        { error: 'No active business found' },
        { status: 404 },
      );
    }

    // Parse and validate the settlement date
    let dateObj: Date;
    try {
      dateObj = new Date(settlementDate);
      if (isNaN(dateObj.getTime())) {
        throw new Error('Invalid date');
      }
    } catch {
      return NextResponse.json(
        { error: 'Invalid settlement date format. Use YYYY-MM-DD' },
        { status: 400 },
      );
    }

    // Get all settlement records for this business on this specific date
    const settlementsResult: any = await db.query(
      `SELECT fr.id,
              fr.amount,
              fr.description,
              fr.related_id,
              fr.reference,
              fr.created_at,
              t.order_id,
              t.payment_method,
              t.currency
         FROM finance_records fr
         LEFT JOIN transactions t ON fr.related_id = t.order_id OR fr.related_id = t.id
        WHERE fr.business_id = $1
          AND fr.record_type = 'settlement'
          AND DATE(fr.created_at) = $2::date
        ORDER BY fr.created_at DESC`,
      [activeBusiness.id, settlementDate],
    );

    const settlementRecords = Array.isArray(settlementsResult)
      ? settlementsResult
      : settlementsResult?.rows ?? [];

    // Get refund information for each settled transaction
    const enrichedRecords = await Promise.all(
      settlementRecords.map(async (record: any) => {
        let refundInfo = null;

        if (record.related_id) {
          const refundsResult: any = await db.query(
            `SELECT id, refund_amount, status, processed_at
               FROM refunds
              WHERE transaction_id = $1
                AND status NOT IN ('failed', 'rejected')
              ORDER BY processed_at DESC`,
            [record.related_id],
          );

          const refunds = Array.isArray(refundsResult)
            ? refundsResult
            : refundsResult?.rows ?? [];

          if (refunds.length > 0) {
            const totalRefunded = refunds.reduce(
              (sum: number, r: any) => sum + Number(r.refund_amount || 0),
              0,
            );
            refundInfo = {
              total_refunded: totalRefunded,
              refund_count: refunds.length,
              refunds: refunds.map((r: any) => ({
                id: r.id,
                amount: Number(r.refund_amount || 0),
                status: r.status,
                processed_at: r.processed_at,
              })),
            };
          }
        }

        return {
          id: record.id,
          amount: Number(record.amount || 0),
          description: record.description,
          related_id: record.related_id,
          order_id: record.order_id,
          reference: record.reference,
          payment_method: record.payment_method,
          currency: record.currency || 'NGN',
          created_at: record.created_at,
          refund_info: refundInfo,
          is_fully_refunded: Number(record.amount || 0) <= 0,
        };
      }),
    );

    // Calculate settlement summary
    const totalGross = await db.query(
      `SELECT COALESCE(SUM(t.amount), 0) as total
         FROM finance_records fr
         LEFT JOIN transactions t ON fr.related_id = t.order_id OR fr.related_id = t.id
        WHERE fr.business_id = $1
          AND fr.record_type = 'settlement'
          AND DATE(fr.created_at) = $2::date`,
      [activeBusiness.id, settlementDate],
    );

    const totalGrossRow = Array.isArray(totalGross) ? totalGross[0] : totalGross?.rows?.[0];
    const summaryTotal = Number(totalGrossRow?.total || 0);
    const totalRefunded = enrichedRecords.reduce((sum: number, r: any) => {
      return sum + (r.refund_info?.total_refunded || 0);
    }, 0);
    const totalSettled = enrichedRecords.reduce(
      (sum: number, r: any) => sum + r.amount,
      0,
    );

    return NextResponse.json({
      settlement_date: settlementDate,
      summary: {
        total_transactions: enrichedRecords.length,
        total_gross: summaryTotal,
        total_refunded: totalRefunded,
        total_settled: totalSettled,
        settlement_time: enrichedRecords[0]?.created_at || null,
      },
      settlements: enrichedRecords,
    });
  } catch (err) {
    console.error('[v0] GET /business/settlements/[settlementDate] error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch settlement details' },
      { status: 500 },
    );
  }
}
