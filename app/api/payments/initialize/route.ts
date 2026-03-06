import { NextRequest, NextResponse } from 'next/server';
import { initializePayment, generatePaymentReference } from '@/lib/paystack';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { amount, orderId, email, reference: providedReference } = body;

    if (!amount || !orderId || !email) {
      return NextResponse.json(
        { error: 'Amount, orderId, and email are required' },
        { status: 400 }
      );
    }

    const reference = providedReference || generatePaymentReference();

    console.log('[v0] Initializing Paystack payment:', {
      amount,
      orderId,
      email,
      reference,
    });

    const paystackResponse = await initializePayment(amount, email, reference, {
      orderId,
      email,
    });

    console.log('[v0] Paystack response:', paystackResponse);

    return NextResponse.json({
      success: true,
      reference,
      authorizationUrl: paystackResponse.data.authorization_url,
      accessCode: paystackResponse.data.access_code,
    });
  } catch (error) {
    console.error('[v0] Payment initialization error:', error);
    return NextResponse.json(
      { error: 'Failed to initialize payment', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
