import { NextRequest, NextResponse } from 'next/server';
import { db, getOne } from '@/lib/db';
import { requireAdmin, isAdminAuth } from '@/lib/admin-auth';
import { normalizeAmount, requireTicket } from '@/lib/security/pin';
import { getFundingTarget, SMS_MIN_FUNDING, SMS_PENDING_WINDOW_MINUTES } from '@/lib/kudisms-funding';
import { createAdminRecipient, initiateAdminTransfer, newAdminTransferIds, ProviderRejected, reconcileAdminTransfers, reverseAdminTransfer, syncAdminTransfer, verifyAdminTransfer } from '@/lib/admin-transfers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req); if (!isAdminAuth(auth)) return auth;
  let transferId = '';
  try {
    const body = await req.json(); const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < SMS_MIN_FUNDING) return NextResponse.json({ error: `Minimum SMS funding is ₦${SMS_MIN_FUNDING.toLocaleString()}` }, { status: 400 });
    if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) return NextResponse.json({ error: 'Amount can have at most 2 decimal places' }, { status: 400 });

    // Settle anything already in flight before deciding whether a new transfer
    // may start, so a completed funding never blocks the next one.
    await reconcileAdminTransfers('sms_funding');
    const inFlight = await getOne(
      `SELECT id, amount, status, created_at
         FROM admin_transfers
        WHERE kind = $1 AND status IN ('pending', 'otp')
          AND created_at > NOW() - ($2 || ' minutes')::interval
        ORDER BY created_at DESC
        LIMIT 1`,
      ['sms_funding', String(SMS_PENDING_WINDOW_MINUTES)],
    );
    if (inFlight) {
      return NextResponse.json({
        error: 'A funding transfer is already being processed',
        code: 'FUNDING_PENDING',
        inFlight: {
          id: inFlight.id,
          amount: Number(inFlight.amount ?? 0),
          status: String(inFlight.status ?? 'pending').toLowerCase(),
          createdAt: inFlight.created_at,
        },
      }, { status: 409 });
    }

    const target = await getFundingTarget(); if (!target.configured) return NextResponse.json({ error: target.error || 'SMS funding is not configured' }, { status: 400 });
    const bind = { amount: normalizeAmount(amount) };
    if (!(await requireTicket({ ticket: body.authorizationTicket, userId: auth.userId, businessId: null, action: 'sms_funding', bind }))) return NextResponse.json({ error: 'PIN authorization required', code: 'PIN_REQUIRED' }, { status: 403 });
    const ids = newAdminTransferIds('smsf'); transferId = ids.id;
    const reservedRaw: any = await db.query('SELECT fb_admin_reserve_transfer($1,$2,$3,$4,$5,$6,$7,$8,$9) AS result', ['sms_funding', amount, ids.id, ids.reference, target.bankCode, process.env.KUDISMS_FUNDING_ACCOUNT_NUMBER, target.accountName, auth.userId, SMS_MIN_FUNDING]);
    const rawResult = (Array.isArray(reservedRaw) ? reservedRaw[0]?.result : reservedRaw?.rows?.[0]?.result); const reserved = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult || {};
    if (reserved.status === 'below_minimum') return NextResponse.json({ error: `Minimum SMS funding is ₦${SMS_MIN_FUNDING.toLocaleString()}` }, { status: 400 });
    if (reserved.status === 'insufficient_balance') return NextResponse.json({ error: 'Your available platform revenue is not enough' }, { status: 400 });
    if (reserved.status !== 'reserved') return NextResponse.json({ error: 'SMS funding could not be reserved' }, { status: 400 });
    try {
      const recipient = await createAdminRecipient(process.env.KUDISMS_FUNDING_ACCOUNT_NUMBER!, target.bankCode!, target.accountName!);
      const transfer = await initiateAdminTransfer(recipient.recipient_code, amount, ids.reference, 'KudiSMS wallet funding');
      await syncAdminTransfer(ids.id, transfer);
      return NextResponse.json({ success: true, transferId: ids.id, status: String(transfer.status || 'pending').toLowerCase() }, { status: 201 });
    } catch (error) {
      if (error instanceof ProviderRejected) { await reverseAdminTransfer(ids.id, error.message); return NextResponse.json({ error: error.message }, { status: 502 }); }
      try { const verified = await verifyAdminTransfer(ids.reference); if (verified.notFound) { await reverseAdminTransfer(ids.id, 'Transfer not found at provider'); return NextResponse.json({ error: 'Transfer not found at provider' }, { status: 502 }); } await syncAdminTransfer(ids.id, verified.data); return NextResponse.json({ success: true, transferId: ids.id, status: String(verified.data?.status || 'pending').toLowerCase() }, { status: 202 }); }
      catch { return NextResponse.json({ success: true, transferId: ids.id, status: 'pending' }, { status: 202 }); }
    }
  } catch { return NextResponse.json({ error: 'Internal server error' }, { status: 500 }); }
}
