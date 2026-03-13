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

      let orderId = paymentData.metadata?.orderId;
      let businessSlug = '';

      // Update order payment status in database
      if (orderId) {
        const updateResult = await db.query(
          'UPDATE orders SET payment_status = $1, payment_reference = $2, paid_at = NOW() WHERE id = $3 RETURNING business_id',
          ['completed', reference, orderId]
        );
        console.log('[v0] Order updated with payment status');

        // Fetch business slug from the business_id
        if (updateResult && updateResult.length > 0) {
          const businessId = updateResult[0].business_id;
          const businessResult = await db.query(
            'SELECT slug FROM public.businesses WHERE id = $1',
            [businessId]
          );

          if (businessResult && businessResult.length > 0) {
            businessSlug = businessResult[0].slug;
            console.log('[v0] Business slug fetched:', businessSlug);
          }
        }
      }

      return NextResponse.json({
        success: true,
        status: 'success',
        amount: paymentData.amount / 100,
        reference: paymentData.reference,
        orderId,
        businessSlug,
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
