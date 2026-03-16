import { NextRequest, NextResponse } from 'next/server';

const PAYSTACK_API_KEY = process.env.PAYSTACK_SECRET_KEY;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accountNumber, bankCode } = body;

    if (!accountNumber || !bankCode) {
      return NextResponse.json(
        { error: 'Account number and bank code are required' },
        { status: 400 }
      );
    }

    if (!PAYSTACK_API_KEY) {
      return NextResponse.json(
        { error: 'Paystack API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://api.paystack.co/bank/validate?account_number=${accountNumber}&bank_code=${bankCode}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${PAYSTACK_API_KEY}`,
        },
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('[v0] Paystack validation error:', data);
      return NextResponse.json(
        { error: data.message || 'Account validation failed' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      account_number: data.data?.account_number,
      account_name: data.data?.account_name,
      bank_id: data.data?.bank_id,
    });
  } catch (error) {
    console.error('[v0] Validate account error:', error);
    return NextResponse.json(
      { error: 'Failed to validate account' },
      { status: 500 }
    );
  }
}
