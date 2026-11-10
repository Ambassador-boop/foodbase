import crypto from 'crypto';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';

export class ProviderRejected extends Error {}
export class ProviderUnreachable extends Error {}

export async function paystackRefund(transactionRef: string, amountKobo: number, opts: { customer_note?: string; merchant_note?: string }) {
  let response: Response;
  try {
    response = await fetch(`${PAYSTACK_BASE_URL}/refund`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY || ''}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: transactionRef, amount: amountKobo, currency: 'NGN', ...opts }),
    });
  } catch {
    throw new ProviderUnreachable('Payment provider is unreachable');
  }
  let json: any;
  try { json = await response.json(); } catch { throw new ProviderUnreachable('Payment provider returned an invalid response'); }
  if (response.status >= 500) throw new ProviderUnreachable('Payment provider is temporarily unavailable');
  if (!response.ok || !json.status) throw new ProviderRejected(json.message || 'Refund was rejected by the payment provider');
  return json.data;
}

export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    reference: string;
    amount: number;
    currency: string;
    status: string;
    paid_at: string;
    customer: {
      id: number;
      email: string;
      customer_code: string;
    };
    fees?: number | null;
    metadata?: Record<string, any>;
  };
}

export async function initializePayment(
  amount: number,
  email: string,
  reference: string,
  metadata?: Record<string, any>
): Promise<PaystackInitializeResponse> {
  // Get the base URL for redirects - handle both development and production
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://foodbase.ng';

  const response = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY || ''}`,
    },
    body: JSON.stringify({
      amount: Math.round(amount * 100),
      email,
      reference,
      redirect_url: `${baseUrl}/api/payments/webhook?reference=${encodeURIComponent(reference)}`,
      metadata,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to initialize payment');
  }

  return response.json();
}

export async function verifyPayment(reference: string): Promise<PaystackVerifyResponse> {
  const response = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY || ''}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error('Failed to verify payment');
  }

  return response.json();
}

export async function getPaymentStatus(reference: string): Promise<string> {
  try {
    const data = await verifyPayment(reference);
    return data.data.status;
  } catch (error) {
    console.error('Error getting payment status:', error);
    throw error;
  }
}

export function generatePaymentReference(): string {
  return `FB${crypto.randomUUID().replace(/-/g, '').toUpperCase()}`;
}

export interface PaystackBalanceSnapshot {
  /** Spendable NGN balance in naira, or null when it could not be read. */
  balance: number | null
  /** ISO timestamp of the reading. */
  asOf: string
  /** True when the value came from an earlier successful read. */
  stale: boolean
  /** Machine-readable reason when `balance` is null. */
  reason?: 'not_configured' | 'unreachable' | 'rejected'
  message?: string
}

interface CachedBalance {
  snapshot: PaystackBalanceSnapshot
  expiresAt: number
}

const BALANCE_TTL_MS = 60_000
let balanceCache: CachedBalance | null = null

/**
 * Reads the platform's Paystack NGN balance. The provider returns kobo.
 * Results (including transient failures) are cached for 60 seconds so an admin
 * dashboard refresh never hammers the provider. Previously known values are
 * returned marked `stale` when a refresh fails, and are never invented.
 */
export async function getPaystackBalance(now = Date.now()): Promise<PaystackBalanceSnapshot> {
  if (balanceCache && balanceCache.expiresAt > now) return balanceCache.snapshot

  const cache = (snapshot: PaystackBalanceSnapshot) => {
    balanceCache = { snapshot, expiresAt: now + BALANCE_TTL_MS }
    return snapshot
  }

  if (!process.env.PAYSTACK_SECRET_KEY) {
    return cache({ balance: null, asOf: new Date(now).toISOString(), stale: false, reason: 'not_configured', message: 'Paystack is not configured in this environment' })
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 6_000)
  try {
    const response = await fetch(`${PAYSTACK_BASE_URL}/balance`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    })
    const json: any = await response.json().catch(() => null)
    if (!response.ok || !json?.status || !Array.isArray(json.data)) {
      return cache({
        balance: null,
        asOf: new Date(now).toISOString(),
        stale: false,
        reason: 'rejected',
        message: typeof json?.message === 'string' ? json.message : 'Paystack rejected the balance request',
      })
    }
    const ngn = json.data.find((entry: any) => String(entry?.currency || '').toUpperCase() === 'NGN') ?? json.data[0]
    const kobo = Number(ngn?.balance)
    if (!Number.isFinite(kobo)) {
      return cache({ balance: null, asOf: new Date(now).toISOString(), stale: false, reason: 'rejected', message: 'Paystack returned no NGN balance' })
    }
    return cache({ balance: Math.round(kobo) / 100, asOf: new Date(now).toISOString(), stale: false })
  } catch (error) {
    const previous = balanceCache?.snapshot
    return cache({
      balance: previous?.balance ?? null,
      asOf: previous?.asOf ?? new Date(now).toISOString(),
      stale: Boolean(previous?.balance !== null && previous?.balance !== undefined),
      reason: previous?.balance !== null && previous?.balance !== undefined ? undefined : 'unreachable',
      message: error instanceof Error ? error.message : 'Payment provider is unreachable',
    })
  } finally {
    clearTimeout(timeout)
  }
}
