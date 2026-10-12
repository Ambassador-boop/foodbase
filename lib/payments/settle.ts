import { query } from '@/lib/db';
import { computeAvailableAt } from '@/lib/wat';

export type SettlementResult = {
  status: 'settled' | 'already_settled' | 'amount_mismatch' | 'order_not_found' | string;
  [key: string]: unknown;
};

type PaystackPaymentData = {
  reference: string;
  amount: number;
  currency: string;
  fees?: number | null;
  metadata?: { orderId?: string | null } | null;
};

export async function settlePaystackPayment(data: PaystackPaymentData): Promise<SettlementResult> {
  const providerFeeKobo = typeof data.fees === 'number' ? Math.round(data.fees) : null;
  const availableAt = computeAvailableAt(new Date());
  const result = await query(
    'SELECT fb_settle_payment($1,$2,$3,$4,$5,$6) AS result',
    [
      data.reference,
      data.metadata?.orderId ?? null,
      Math.round(data.amount),
      providerFeeKobo,
      data.currency,
      availableAt.toISOString(),
    ],
  );
  const rows = Array.isArray(result) ? result : (result as { rows?: unknown[] })?.rows ?? [];
  const value = (rows[0] as { result?: SettlementResult })?.result;
  return typeof value === 'string' ? JSON.parse(value) : value as SettlementResult;
}
