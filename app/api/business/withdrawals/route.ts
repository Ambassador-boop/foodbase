import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth';
import { db } from '@/lib/db';
import { getActiveBusinessForUser } from '@/lib/active-business';
import { nanoid } from 'nanoid';
import { reconcileBusinessWithdrawals } from '@/lib/withdrawals';

const PAYSTACK_API_KEY = process.env.PAYSTACK_SECRET_KEY;
const PAYSTACK_BASE = 'https://api.paystack.co';
const FREE_DAILY_WITHDRAWALS = 3;
const OVERAGE_FEE_NGN = 500; // flat ₦500 fee for the 4th+ withdrawal of the day

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

async function getUserId(req: NextRequest) {
  const token =
    req.headers.get('authorization')?.replace('Bearer ', '') ||
    req.cookies.get('auth_token')?.value;
  if (!token) return null;
  const payload = await verifyJWT(token);
  if (!payload) return null;
  return (payload as any).userId || (payload as any).id;
}

function genReference() {
  // Paystack: lowercase a-z, 0-9, hyphen, underscore. 16-50 chars.
  return `wdr_${nanoid(20).toLowerCase().replace(/[^a-z0-9_-]/g, '')}`;
}

async function createTransferRecipient(
  accountNumber: string,
  bankCode: string,
  accountName: string,
) {
  const res = await fetch(`${PAYSTACK_BASE}/transferrecipient`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'nuban',
      name: accountName,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: 'NGN',
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || 'Failed to create transfer recipient');
  }
  return json.data; // { recipient_code, ... }
}

async function initiateTransfer(
  recipientCode: string,
  amountNaira: number,
  reference: string,
  reason: string,
) {
  const res = await fetch(`${PAYSTACK_BASE}/transfer`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: 'balance',
      amount: Math.round(amountNaira * 100),
      recipient: recipientCode,
      reference,
      reason,
    }),
  });
  const json = await res.json();
  if (!res.ok || !json.status) {
    throw new Error(json.message || 'Failed to initiate transfer');
  }
  return json.data; // { transfer_code, status, reference, ... }
}

/* ------------------------------------------------------------------ */
/*  GET — list all withdrawals for the authed business owner           */
/* ------------------------------------------------------------------ */

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

    // Self-heal: refresh any pending Paystack transfers AND restore
    // funds for terminal-failed withdrawals that haven't been reversed
    // yet. Idempotent — won't double-credit on repeat calls.
    try {
      await reconcileBusinessWithdrawals(business.id);
    } catch (err) {
      console.error('[v0] withdrawals list: reconcile failed:', err);
    }

    const rows: any = await db.query(
      `SELECT
         w.id,
         w.amount,
         w.net_amount,
         w.withdrawal_fee,
         w.service_fee,
         w.status,
         w.bank_code,
         w.bank_account_number,
         w.bank_account_holder,
         w.payment_reference,
         w.reference,
         w.paystack_transfer_id,
         w.transfer_code,
         w.failure_reason,
         w.gateway_response,
         w.notes,
         w.requested_at,
         w.processed_at,
         w.created_at,
         w.updated_at
       FROM withdrawals w
       WHERE w.business_id = $1
       ORDER BY w.created_at DESC
       LIMIT 200`,
      [business.id],
    );

    const list = Array.isArray(rows) ? rows : rows?.rows ?? [];
    return NextResponse.json(
      list.map((r: any) => ({
        ...r,
        amount: Number(r.amount ?? 0),
        net_amount: r.net_amount != null ? Number(r.net_amount) : null,
        withdrawal_fee: r.withdrawal_fee != null ? Number(r.withdrawal_fee) : 0,
        service_fee: r.service_fee != null ? Number(r.service_fee) : 0,
      })),
    );
  } catch (err) {
    console.error('[v0] GET /business/withdrawals error:', err);
    return NextResponse.json(
      { error: 'Failed to fetch withdrawals' },
      { status: 500 },
    );
  }
}

/* ------------------------------------------------------------------ */
/*  POST — initiate a Paystack transfer                                */
/* ------------------------------------------------------------------ */

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserId(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!PAYSTACK_API_KEY) {
      return NextResponse.json(
        { error: 'Paystack is not configured on this server.' },
        { status: 500 },
      );
    }

    const body = await req.json();
    const amountNaira = parseFloat(String(body.amount ?? ''));
    const bankCode: string = String(body.bank_code ?? '').trim();
    const bankAccountNumber: string = String(body.bank_account_number ?? '').trim();
    const bankAccountHolder: string = String(body.bank_account_holder ?? '').trim();
    const notes: string = String(body.notes ?? '').slice(0, 500);

    if (!amountNaira || amountNaira <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    if (!bankCode || !bankAccountNumber || !bankAccountHolder) {
      return NextResponse.json(
        { error: 'Bank details are required' },
        { status: 400 },
      );
    }

    /* ------------- Business + balance check ----------------------- */
    const business = await getActiveBusinessForUser(userId);
    if (!business) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }
    const availableBalance = Number(business.available_balance ?? 0);

    /* ------------- Daily withdrawal counter ----------------------- */
    const todayCountRows: any = await db.query(
      `SELECT COUNT(*)::int AS count
         FROM withdrawals
        WHERE business_id = $1
          AND created_at >= date_trunc('day', NOW())
          AND status NOT IN ('failed','rejected','abandoned','blocked')`,
      [business.id],
    );
    const todayCountList = Array.isArray(todayCountRows)
      ? todayCountRows
      : todayCountRows?.rows ?? [];
    const todayCount = Number(todayCountList[0]?.count ?? 0);

    const incursOverageFee = todayCount >= FREE_DAILY_WITHDRAWALS;
    const withdrawalFee = incursOverageFee ? OVERAGE_FEE_NGN : 0;
    const totalDeduction = amountNaira + withdrawalFee;

    if (totalDeduction > availableBalance) {
      return NextResponse.json(
        {
          error: incursOverageFee
            ? `Insufficient balance. A ₦${OVERAGE_FEE_NGN} fee applies because you've already made ${FREE_DAILY_WITHDRAWALS} withdrawals today.`
            : 'Insufficient available balance',
        },
        { status: 400 },
      );
    }

    /* ------------- Create Paystack recipient + transfer ----------- */
    const reference = genReference();
    const withdrawalId = `wd_${nanoid(14)}`;

    let recipientCode: string;
    let transferRecipientRowId: string;

    try {
      const recipient = await createTransferRecipient(
        bankAccountNumber,
        bankCode,
        bankAccountHolder,
      );
      recipientCode = recipient.recipient_code;
      transferRecipientRowId = `tr_${nanoid(14)}`;

      await db.query(
        `INSERT INTO transfer_recipients
          (id, business_id, paystack_recipient_id, recipient_code, account_name,
           account_number, bank_code, account_type, is_active, created_at, updated_at)
         VALUES ($1,$2,$3,$3,$4,$5,$6,'nuban',true,NOW(),NOW())
         ON CONFLICT DO NOTHING`,
        [
          transferRecipientRowId,
          business.id,
          recipientCode,
          bankAccountHolder,
          bankAccountNumber,
          bankCode,
        ],
      );
    } catch (err: any) {
      console.error('[v0] Recipient create failed:', err);
      return NextResponse.json(
        { error: err?.message || 'Failed to create transfer recipient' },
        { status: 502 },
      );
    }

    let transferData: any;
    try {
      transferData = await initiateTransfer(
        recipientCode,
        amountNaira,
        reference,
        notes || 'Business withdrawal',
      );
    } catch (err: any) {
      console.error('[v0] Initiate transfer failed:', err);
      // Record the failed attempt so the user sees it on the timeline
      await db.query(
        `INSERT INTO withdrawals
          (id, business_id, amount, net_amount, withdrawal_fee, service_fee,
           bank_code, bank_account_number, bank_account_holder,
           transfer_recipient_id, reference, payment_reference, status,
           failure_reason, notes, requested_at, created_at, updated_at)
         VALUES ($1,$2,$3,$3,$4,0,$5,$6,$7,$8,$9,$9,'failed',$10,$11,NOW(),NOW(),NOW())`,
        [
          withdrawalId,
          business.id,
          amountNaira,
          withdrawalFee,
          bankCode,
          bankAccountNumber,
          bankAccountHolder,
          transferRecipientRowId,
          reference,
          err?.message?.slice(0, 500) || 'Transfer initiation failed',
          notes || null,
        ],
      );
      return NextResponse.json(
        { error: err?.message || 'Failed to initiate transfer', withdrawalId },
        { status: 502 },
      );
    }

    /* ------------- Persist withdrawal ----------------------------- */
    await db.query(
      `INSERT INTO withdrawals
        (id, business_id, amount, net_amount, withdrawal_fee, service_fee,
         bank_code, bank_account_number, bank_account_holder,
         transfer_recipient_id, paystack_transfer_id, transfer_code,
         reference, payment_reference, status, notes,
         requested_at, created_at, updated_at)
       VALUES ($1,$2,$3,$3,$4,0,$5,$6,$7,$8,$9,$9,$10,$10,$11,$12,NOW(),NOW(),NOW())`,
      [
        withdrawalId,
        business.id,
        amountNaira,
        withdrawalFee,
        bankCode,
        bankAccountNumber,
        bankAccountHolder,
        transferRecipientRowId,
        transferData.transfer_code,
        reference,
        transferData.status || 'pending',
        notes || null,
      ],
    );

    /* ------------- Deduct from business balance ------------------- */
    await db.query(
      `UPDATE businesses
          SET available_balance = available_balance - $1,
              updated_at = NOW()
        WHERE id = $2`,
      [totalDeduction, business.id],
    );

    return NextResponse.json(
      {
        success: true,
        withdrawalId,
        reference,
        status: transferData.status || 'pending',
        withdrawalFee,
        message: 'Withdrawal initiated',
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[v0] POST /business/withdrawals error:', err);
    return NextResponse.json(
      { error: 'Failed to create withdrawal' },
      { status: 500 },
    );
  }
}
