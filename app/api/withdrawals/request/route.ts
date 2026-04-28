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

    // Get business and verify ownership
    const businessResult = await db.query(
      `SELECT id, available_balance FROM businesses WHERE owner_id = $1`,
      [userId]
    );

    if (!businessResult || businessResult.length === 0) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    const business = businessResult[0];
    const withdrawAmount = parseFloat(amount);

    if (withdrawAmount <= 0) {
      return NextResponse.json(
        { error: 'Invalid withdrawal amount' },
        { status: 400 }
      );
    }

    if (withdrawAmount > business.available_balance) {
      return NextResponse.json(
        { error: 'Insufficient available balance' },
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

      // Create withdrawal record
      await db.query(
        `INSERT INTO withdrawals 
        (id, business_id, amount, service_fee, transfer_recipient_id, paystack_transfer_id, status, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          withdrawalId,
          business.id,
          withdrawAmount,
          serviceFee,
          transferRecipientId,
          transfer.transfer_code,
          'completed',
        ]
      );

      console.log('[v0] Withdrawal record created:', withdrawalId);

      // Update available balance (subtract gross amount, NOT the service fee)
      await db.query(
        `UPDATE businesses SET available_balance = available_balance - $1 WHERE id = $2`,
        [withdrawAmount, business.id]
      );

      return NextResponse.json({
        success: true,
        withdrawalId,
        message: 'Withdrawal request successful',
      });
    } catch (paystackError) {
      console.error('[v0] Paystack error:', paystackError);

      const errorMessage =
        paystackError instanceof Error ? paystackError.message : 'Unknown error';

      // Create failed withdrawal record for reference
      await db.query(
        `INSERT INTO withdrawals 
        (id, business_id, amount, service_fee, status, failure_reason, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
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
