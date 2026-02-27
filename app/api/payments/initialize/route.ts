import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { initializePayment, generatePaymentReference } from '@/lib/paystack';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'secret');

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await jwtVerify(token, secret);
    const email = verified.payload.email as string;

    const body = await request.json();
    const { amount, orderId } = body;

    if (!amount || !orderId) {
      return NextResponse.json(
        { error: 'Amount and orderId are required' },
        { status: 400 }
      );
    }

    const reference = generatePaymentReference();

    const paystackResponse = await initializePayment(amount, email, reference, {
      orderId,
      email,
    });

    return NextResponse.json({
      success: true,
      reference,
      authorizationUrl: paystackResponse.data.authorization_url,
      accessCode: paystackResponse.data.access_code,
    });
  } catch (error) {
    console.error('Payment initialization error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize payment' },
      { status: 500 }
    );
  }
}
