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
      let businessId = '';

      // Update order payment status in database
      if (orderId) {
        const updateResult = await db.query(
          'UPDATE orders SET payment_status = $1, payment_reference = $2, paid_at = NOW() WHERE id = $3 RETURNING business_id, customer_name, total_amount',
          ['completed', reference, orderId]
        );
        console.log('[v0] Order updated with payment status');

        // Fetch business slug and info from the business_id
        if (updateResult && updateResult.length > 0) {
          businessId = updateResult[0].business_id;
          const customerName = updateResult[0].customer_name;
          const totalAmount = updateResult[0].total_amount;
          
          const businessResult = await db.query(
            'SELECT slug FROM public.businesses WHERE id = $1',
            [businessId]
          );

          if (businessResult && businessResult.length > 0) {
            businessSlug = businessResult[0].slug;
            console.log('[v0] Business slug fetched:', businessSlug);
          }

          // Insert transaction details into transactions table
          try {
            await db.query(
              `INSERT INTO transactions (order_id, business_id, amount, transaction_type, status, payment_reference, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
              [orderId, businessId, totalAmount, 'income', 'completed', reference]
            );
            console.log('[v0] Transaction record inserted for order:', orderId);
          } catch (transactionError) {
            console.error('[v0] Error inserting transaction record:', transactionError);
            // Don't fail payment verification if transaction insert fails
          }
        }

          // Send OneSignal notification
          try {
            const notificationResponse = await fetch(
              `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/notifications/send-order`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  orderId,
                  customerName,
                  businessId,
                  paymentStatus: 'completed',
                }),
              }
            );

            if (!notificationResponse.ok) {
              console.error('[v0] Failed to send notification');
            } else {
              console.log('[v0] Notification sent for order:', orderId);
            }
          } catch (notificationError) {
            console.error('[v0] Error sending notification:', notificationError);
            // Don't fail payment verification if notification fails
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
