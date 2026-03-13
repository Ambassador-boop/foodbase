import { NextRequest, NextResponse } from 'next/server';
import { verifyPayment } from '@/lib/paystack';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { reference } = body;

    if (!reference) {
      return NextResponse.json(
        { error: 'Reference is required' },
        { status: 400 }
      );
    }

    console.log('[v0] Verifying payment with reference:', reference);

    // Verify with Paystack
    const paystackResponse = await verifyPayment(reference);

    console.log('[v0] Paystack verification response:', paystackResponse);

    if (!paystackResponse.status) {
      return NextResponse.json(
        { error: 'Payment verification failed' },
        { status: 400 }
      );
    }

    const paymentData = paystackResponse.data;

    // Check if payment is successful
    if (paymentData.status === 'success') {
      console.log('[v0] Payment successful for reference:', reference);

      // Update order payment status in database
      if (paymentData.metadata?.orderId) {
        await db.query(
          'UPDATE orders SET payment_status = $1, payment_reference = $2, paid_at = NOW() WHERE id = $3',
          ['completed', reference, paymentData.metadata.orderId]
        );
        console.log('[v0] Order updated with payment status');
      }

      return NextResponse.json({
        success: true,
        status: 'success',
        amount: paymentData.amount / 100,
        reference: paymentData.reference,
        message: 'Payment verified successfully',
      });
    }

    console.log('[v0] Payment not successful. Status:', paymentData.status);

    return NextResponse.json(
      { error: 'Payment was not successful', status: paymentData.status },
      { status: 400 }
    );
  } catch (error) {
    console.error('[v0] Payment verification error:', error);
    return NextResponse.json(
      { error: 'Failed to verify payment', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
