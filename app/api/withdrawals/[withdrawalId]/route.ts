import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { verifyAndSyncTransfer, reverseFailedWithdrawalIfNeeded } from '@/lib/withdrawals';

/* ------------------------------------------------------------------ */
/*  GET — single withdrawal with timeline data                         */
/* ------------------------------------------------------------------ */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ withdrawalId: string }> },
) {
  try {
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
    const { withdrawalId } = await params;

    const result: any = await db.query(
      `SELECT
         w.*,
         b.name AS business_name
       FROM withdrawals w
       JOIN businesses b ON w.business_id = b.id
       WHERE w.id = $1 AND b.owner_id = $2`,
      [withdrawalId, userId],
    );
    const list = Array.isArray(result) ? result : result?.rows ?? [];
    if (list.length === 0) {
      return NextResponse.json(
        { error: 'Withdrawal not found' },
        { status: 404 },
      );
    }
    let row = list[0];

    // If the withdrawal is not yet conclusive, hit Paystack to refresh it
    const inconclusive = ['pending', 'otp', 'received', 'queued'];
    if (
      row.reference &&
      inconclusive.includes(String(row.status).toLowerCase())
    ) {
      const fresh = await verifyAndSyncTransfer(row.reference, row.id);
      if (fresh) {
        row = {
          ...row,
          status: fresh.status,
          gateway_response: fresh.gateway_response || row.gateway_response,
          transfer_code: fresh.transfer_code || row.transfer_code,
        };
      }
    }

    // After syncing status, check if it's now in a terminal failed state
    // and reverse the balance if it hasn't been reversed yet
    const terminalFailedStatuses = new Set([
      'failed',
      'reversed',
      'abandoned',
      'blocked',
      'rejected',
    ]);
    if (terminalFailedStatuses.has(String(row.status).toLowerCase())) {
      const reversalResult = await reverseFailedWithdrawalIfNeeded(row);
      if (reversalResult.reversed) {
        console.log('[v0] GET /withdrawals/[id]: Auto-reversed failed withdrawal:', withdrawalId);
        // Refresh the row to get the updated balance_reversed flag
        const refreshResult: any = await db.query(
          `SELECT w.* FROM withdrawals w WHERE w.id = $1`,
          [withdrawalId],
        );
        const refreshList = Array.isArray(refreshResult) ? refreshResult : refreshResult?.rows ?? [];
        if (refreshList.length > 0) {
          row = refreshList[0];
        }
      }
    }

    return NextResponse.json({
      id: row.id,
      amount: Number(row.amount ?? 0),
      net_amount: row.net_amount != null ? Number(row.net_amount) : null,
      withdrawal_fee:
        row.withdrawal_fee != null ? Number(row.withdrawal_fee) : 0,
      service_fee: row.service_fee != null ? Number(row.service_fee) : 0,
      status: row.status,
      bank_code: row.bank_code,
      bank_account_number: row.bank_account_number,
      bank_account_holder: row.bank_account_holder,
      reference: row.reference || row.payment_reference,
      payment_reference: row.payment_reference,
      transfer_code: row.transfer_code,
      paystack_transfer_id: row.paystack_transfer_id,
      gateway_response: row.gateway_response,
      failure_reason: row.failure_reason,
      notes: row.notes,
      requested_at: row.requested_at,
      processed_at: row.processed_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
      business_name: row.business_name,
      balance_reversed: !!row.balance_reversed,
    });
  } catch (err) {
    console.error('[v0] GET /withdrawals/[id] error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch withdrawal' },
      { status: 500 },
    );
  }
}
