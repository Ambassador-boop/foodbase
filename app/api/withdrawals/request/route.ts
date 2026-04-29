import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { getActiveBusinessForUser } from '@/lib/active-business';
import { generateAlphanumericId } from '@/lib/utils';

const PAYSTACK_API_KEY = process.env.PAYSTACK_SECRET_KEY;
const SERVICE_FEE_PERCENTAGE = 0.075; // 7.5%

async function createTransferRecipient(
  accountNumber: string,
  bankCode: string,
  accountName: string
) {
  if (!PAYSTACK_API_KEY) {
    throw new Error('Paystack API key not configured');
  }

  const params = JSON.stringify({
    type: 'nuban',
    name: accountName,
    account_number: accountNumber,
    bank_code: bankCode,
    currency: 'NGN',
  });

  const response = await fetch('https://api.paystack.co/transferrecipient', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: params,
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('[v0] Paystack create recipient error:', data);
    throw new Error(data.message || 'Failed to create transfer recipient');
  }

  return data.data;
}

async function initiateTransfer(
  recipientCode: string,
  amount: number,
  reference: string
) {
  if (!PAYSTACK_API_KEY) {
    throw new Error('Paystack API key not configured');
  }

  const params = JSON.stringify({
    source: 'balance',
    amount: Math.round(amount * 100), // Convert to kobo
    recipient: recipientCode,
    reference,
    reason: 'Business withdrawal',
  });

  const response = await fetch('https://api.paystack.co/transfer', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: params,
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('[v0] Paystack transfer error:', data);
    throw new Error(data.message || 'Failed to initiate transfer');
  }

  return data.data;
}

export async function POST(request: NextRequest) {
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
    const body = await request.json();
    const { amount, bankCode, accountNumber, accountName } = body;

    if (!amount || !bankCode || !accountNumber || !accountName) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Resolve the active business for this owner (cookie-based switcher).
    const business = await getActiveBusinessForUser(userId);
    if (!business) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }
    const withdrawAmount = parseFloat(amount);

    if (withdrawAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid withdrawal amount' },
        { status: 400 }
      );
    }

    // Withdrawals can ONLY be paid out from available_balance.
    // pending_balance is reserved for funds that haven't yet cleared the
    // settlement window (see /api/cron/settle-balances).
    const availableBalance = Number(business.available_balance) || 0;
    if (withdrawAmount > availableBalance) {
      return NextResponse.json(
        {
          error:
            'Insufficient available balance. Pending balance cannot be withdrawn.',
        },
        { status: 400 }
      );
    }

    // Calculate service fee (NOT added to available_balance)
    const serviceFee = withdrawAmount * SERVICE_FEE_PERCENTAGE;
    const netAmount = withdrawAmount - serviceFee;

    const withdrawalId = generateAlphanumericId();

    try {
      // Create transfer recipient in Paystack
      const recipient = await createTransferRecipient(accountNumber, bankCode, accountName);

      console.log('[v0] Transfer recipient created:', recipient.recipient_code);

      // Store transfer recipient in database
      const transferRecipientId = generateAlphanumericId();
      await db.query(
        `INSERT INTO transfer_recipients 
        (id, business_id, recipient_code, account_number, account_name, bank_code, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [
          transferRecipientId,
          business.id,
          recipient.recipient_code,
          accountNumber,
          accountName,
          bankCode,
        ]
      );

      // Initiate transfer through Paystack
      const transfer = await initiateTransfer(
        recipient.recipient_code,
        netAmount,
        withdrawalId
      );

      console.log('[v0] Transfer initiated:', transfer.reference);

      // Create withdrawal record. Status starts as 'pending' until Paystack
      // confirms via webhook / reconciliation in [withdrawalId]/route.ts.
      // We deduct the gross amount from available_balance immediately and,
      // if the transfer ends up failing, the GET handler returns it.
      await db.query(
        `INSERT INTO withdrawals 
        (id, business_id, amount, service_fee, transfer_recipient_id, paystack_transfer_id, reference, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [
          withdrawalId,
          business.id,
          withdrawAmount,
          serviceFee,
          transferRecipientId,
          transfer.transfer_code,
          withdrawalId,
          'pending',
        ]
      );

      console.log('[v0] Withdrawal record created:', withdrawalId);

      // Update available balance (subtract gross amount, NOT the service fee).
      // If the transfer later fails, we restore this in the GET reconciliation.
      await db.query(
        `UPDATE businesses SET available_balance = GREATEST(0, COALESCE(available_balance, 0) - $1), updated_at = NOW() WHERE id = $2`,
        [withdrawAmount, business.id]
      );

      // finance_records: outflow from available
      try {
        await db.query(
          `INSERT INTO finance_records
             (id, business_id, record_type, bucket, direction, amount,
              related_id, reference, description, created_at)
           VALUES ($1, $2, 'withdrawal', 'available', 'out', $3, $4, $5,
                   'Withdrawal initiated', NOW())`,
          [
            `fr_${generateAlphanumericId()}`,
            business.id,
            withdrawAmount,
            withdrawalId,
            withdrawalId,
          ]
        );
      } catch (err) {
        console.error('[v0] Withdrawal finance_records insert failed:', err);
      }

      return NextResponse.json({
        success: true,
        withdrawalId,
        message: 'Withdrawal request successful',
      });
    } catch (paystackError) {
      console.error('[v0] Paystack error:', paystackError);

      const errorMessage =
        paystackError instanceof Error ? paystackError.message : 'Unknown error';

      // Create failed withdrawal record for reference. No balance was
      // deducted (we only deduct AFTER Paystack accepts the transfer), so
      // there's nothing to restore here.
      await db.query(
        `INSERT INTO withdrawals 
        (id, business_id, amount, service_fee, status, failure_reason, balance_reversed, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, true, NOW())`,
        [
          withdrawalId,
          business.id,
          withdrawAmount,
          serviceFee,
          'failed',
          errorMessage,
        ]
      );

      return NextResponse.json(
        { error: 'Failed to process withdrawal: ' + errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[v0] Withdrawal request error:', error);
    return NextResponse.json(
      { error: 'Failed to request withdrawal' },
      { status: 500 }
    );
  }
}
