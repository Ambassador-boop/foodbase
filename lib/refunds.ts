import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import { paystackRefund, ProviderRejected, ProviderUnreachable } from '@/lib/paystack';

export async function createAndSendRefund({ orderId, ownerId, amount, reason, notes }: {
  orderId: string; ownerId: string; amount: number; reason: string; notes?: string;
}) {
  const refundId = `rf_${nanoid(14)}`;
  const customerNote = `Refund issued for your order. ${notes || ''}`.trim();
  const merchantNote = `Refund for order ${orderId} — reason: ${reason}`;
  const raw: any = await db.query(
    'SELECT fb_request_refund($1,$2,$3,$4,$5,$6,$7,$8) AS result',
    [orderId, ownerId, amount, reason, notes || null, refundId, customerNote, merchantNote],
  );
  const row = Array.isArray(raw) ? raw[0] : raw?.rows?.[0];
  const result = typeof row?.result === 'string' ? JSON.parse(row.result) : row?.result;
  if (!result) throw new Error('Refund function returned no result');
  const status = String(result.status);
  if (status === 'not_found') return { response: { error: 'Order not found or not authorized' }, statusCode: 404 };
  if (status === 'not_paid') return { response: { error: `Can only refund completed payments (current status: ${result.payment_status || 'unknown'})` }, statusCode: 400 };
  if (status === 'no_transaction') return { response: { error: 'No transaction found for this order' }, statusCode: 404 };
  if (status === 'invalid_amount') return { response: { error: result.message || 'Invalid refund amount' }, statusCode: 400 };
  if (status === 'exceeds_refundable') return { response: { error: `Only ₦${Number(result.refundable || 0).toLocaleString()} can still be refunded on this order. The service fee is not refundable.` }, statusCode: 400 };
  if (status === 'insufficient_balance') return { response: { error: `Your ${result.bucket} balance (₦${Number(result.balance || 0).toLocaleString()}) is not enough to cover this refund.` }, statusCode: 409 };
  if (status !== 'created') throw new Error(`Unexpected refund status: ${status}`);

  if (!process.env.PAYSTACK_SECRET_KEY || !result.payment_reference) {
    await db.query("UPDATE refunds SET status='failed', failure_reason=$1 WHERE id=$2", ['Refund could not be sent to the payment provider', refundId]);
    await db.query('SELECT fb_reverse_failed_refund($1)', [refundId]);
    return { response: { success: false, refundId, status: 'failed', error: 'Refund could not be sent to the payment provider' }, statusCode: 502 };
  }

  try {
    const data = await paystackRefund(result.payment_reference, Math.round(amount * 100), { customer_note: customerNote, merchant_note: merchantNote });
    await db.query(`UPDATE refunds SET paystack_refund_id=$1,status=$2,channel=$3,deducted_amount=$4,fully_deducted=$5,expected_at=$6,updated_at=NOW() WHERE id=$7`, [String(data.id ?? ''), data.status || 'pending', data.channel || null, data.deducted_amount != null ? Number(data.deducted_amount) / 100 : null, !!data.fully_deducted, data.expected_at || null, refundId]);
    return { response: { success: true, refundId, status: data.status || 'pending', message: 'Refund queued for processing.' }, statusCode: 200 };
  } catch (error) {
    if (error instanceof ProviderUnreachable) return { response: { success: true, refundId, status: 'pending', message: 'Refund submitted, confirmation pending' }, statusCode: 202 };
    if (error instanceof ProviderRejected) {
      await db.query("UPDATE refunds SET status='failed', failure_reason=$1, updated_at=NOW() WHERE id=$2", [error.message, refundId]);
      await db.query('SELECT fb_reverse_failed_refund($1)', [refundId]);
      return { response: { success: false, refundId, status: 'failed', error: error.message }, statusCode: 502 };
    }
    throw error;
  }
}
