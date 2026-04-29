import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyJWT } from '@/lib/auth';
import { generateAlphanumericId } from '@/lib/utils';

const PAYSTACK_API_KEY = process.env.PAYSTACK_SECRET_KEY;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ refundId: string }> }
) {
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
    const resolvedParams = await params;
    const refundId = resolvedParams.refundId;

    if (!PAYSTACK_API_KEY) {
      return NextResponse.json(
        { error: 'Paystack API key not configured' },
        { status: 500 }
      );
    }

    // Get refund details and verify ownership
    const refundResult = await db.query(
      `SELECT r.id, r.transaction_id, r.amount, r.refund_amount, r.status,
              r.balance_affected, r.business_id, o.id as order_id
       FROM refunds r
       JOIN orders o ON r.order_id = o.id
       JOIN businesses b ON o.business_id = b.id
       WHERE r.id = $1 AND b.owner_id = $2`,
      [refundId, userId]
    );

    if (!refundResult || refundResult.length === 0) {
      return NextResponse.json(
        { error: 'Refund not found or not authorized' },
        { status: 404 }
      );
    }

    const refund = refundResult[0];

    if (String(refund.status).toLowerCase() !== 'failed') {
      return NextResponse.json(
        { error: 'Can only retry failed refunds' },
        { status: 400 }
      );
    }

    const refundAmount =
      Number(refund.refund_amount ?? refund.amount ?? 0) || 0;
    const bucket: 'pending' | 'available' =
      String(refund.balance_affected || 'available').toLowerCase() === 'pending'
        ? 'pending'
        : 'available';

    // Retry with Paystack
    const params2 = JSON.stringify({
      refund: refund.transaction_id,
    });

    try {
      const response = await fetch('https://api.paystack.co/refund/retry_with_customer_details', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${PAYSTACK_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: params2,
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('[v0] Paystack retry error:', data);
        // Retry itself didn't dispatch — refund stays failed; nothing to debit.
        return NextResponse.json(
          { error: data.message || 'Paystack retry failed' },
          { status: 400 }
        );
      }

      // Retry accepted. We previously REVERSED the debit when the refund
      // first failed (see /api/refunds/[refundId] GET handler). So we now
      // need to re-debit the same bucket and remove the reversal marker.
      try {
        // Re-debit
        if (bucket === 'pending') {
          await db.query(
            `UPDATE businesses
                SET pending_balance = GREATEST(0, COALESCE(pending_balance, 0) - $1),
                    updated_at = NOW()
              WHERE id = $2`,
            [refundAmount, refund.business_id]
          );
        } else {
          await db.query(
            `UPDATE businesses
                SET available_balance = GREATEST(0, COALESCE(available_balance, 0) - $1),
                    updated_at = NOW()
              WHERE id = $2`,
            [refundAmount, refund.business_id]
          );
        }

        // Audit: cancel any prior 'refund_reversed' entry for this refund by
        // appending a fresh debit entry. (We never mutate finance_records
        // history — it's append-only.)
        await db.query(
          `INSERT INTO finance_records
             (id, business_id, record_type, bucket, direction, amount,
              related_id, reference, description, created_at)
           VALUES ($1, $2, 'refund', $3, 'out', $4, $5, NULL,
                   'Refund retry accepted — re-deducted from balance', NOW())`,
          [
            `fr_${generateAlphanumericId()}`,
            refund.business_id,
            bucket,
            refundAmount,
            refundId,
          ]
        );
      } catch (debitErr) {
        console.error('[v0] Refund retry re-debit failed:', debitErr);
      }

      // Update refund status. We use 'pending' (Paystack returned a fresh
      // queued refund), and let the GET sync push it to processed/failed.
      await db.query(
        `UPDATE refunds
            SET status = 'pending',
                paystack_refund_id = COALESCE($1, paystack_refund_id),
                failure_reason = NULL,
                updated_at = NOW()
          WHERE id = $2`,
        [String(data.data?.id || data.data?.reference || ''), refundId]
      );

      console.log('[v0] Refund retry queued:', refundId);

      return NextResponse.json({
        success: true,
        message: 'Refund retry processed successfully',
      });
    } catch (paystackError) {
      console.error('[v0] Paystack retry error:', paystackError);
      const errorMessage = paystackError instanceof Error ? paystackError.message : 'Unknown error';

      // Update with new failure reason
      await db.query(
        `UPDATE refunds SET failure_reason = $1, updated_at = NOW() WHERE id = $2`,
        [errorMessage, refundId]
      );

      return NextResponse.json(
        { error: 'Failed to retry refund: ' + errorMessage },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[v0] Refund retry error:', error);
    return NextResponse.json(
      { error: 'Failed to retry refund' },
      { status: 500 }
    );
  }
}
