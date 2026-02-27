import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { verifyPayment } from '@/lib/paystack';
import { db } from '@/lib/db';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'secret');

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await jwtVerify(token, secret);
    const userId = verified.payload.userId as string;

    const body = await request.json();
    const { reference } = body;

    if (!reference) {
      return NextResponse.json(
        { error: 'Reference is required' },
        { status: 400 }
      );
    }

    // Verify with Paystack
    const paystackResponse = await verifyPayment(reference);

    if (!paystackResponse.status) {
      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 400 }
      );
    }

    const paymentData = paystackResponse.data;

    // Check if payment is successful
    if (paymentData.status === 'success') {
      // Update order payment status in database
      if (paymentData.metadata?.orderId) {
        await db.query(
          'UPDATE orders SET payment_status = $1, payment_reference = $2, paid_at = NOW() WHERE id = $3',
          ['completed', reference, paymentData.metadata.orderId]
        );
      }

      return NextResponse.json({
        success: true,
        status: 'success',
        amount: paymentData.amount / 100,
        reference: paymentData.reference,
        message: 'Payment verified successfully',
      });
    }

    return NextResponse.json(
      { error: 'Payment was not successful', status: paymentData.status },
      { status: 400 }
    );
  } catch (error) {
    console.error('Payment verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment' },
      { status: 500 }
    );
  }
}
