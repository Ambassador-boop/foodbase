import { getKudiBalance, updateKudiBalance } from '@/lib/pin-utils';

/**
 * The live KudiSMS wallet balance.
 *
 * `available` tells a caller whether the figure is real. When the provider
 * cannot be reached we return `balance: null` rather than 0, so no surface can
 * mistake a failed lookup for an empty wallet. The last stored figure is kept
 * separately as `lastKnownBalance` for context only.
 */
export type LiveBalance = {
  balance: number | null;
  available: boolean;
  lastUpdated: string | null;
  stale: boolean;
  lastKnownBalance: number | null;
  error?: string;
};

export async function getLiveBalance(): Promise<LiveBalance> {
  const stored = await getKudiBalance();
  const lastKnownBalance =
    stored && Number.isFinite(Number(stored.balance)) ? Number(stored.balance) : null;
  try {
    const token = process.env.KUDISMS_TOKEN;
    if (!token) throw new Error('KUDISMS_TOKEN is not configured');
    const response = await fetch(`https://my.kudisms.net/api/balance?token=${encodeURIComponent(token)}`, { cache: 'no-store', signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('KudiSMS balance request failed');
    const data = await response.json();
    const raw = data?.balance ?? data?.data?.balance ?? data?.data?.wallet_balance;
    const balance = typeof raw === 'number' ? raw : Number(String(raw ?? '').replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(balance)) throw new Error('KudiSMS returned no numeric balance');
    await updateKudiBalance(balance);
    return { balance, available: true, lastUpdated: new Date().toISOString(), stale: false, lastKnownBalance: balance };
  } catch {
    return {
      balance: null,
      available: false,
      lastUpdated: (stored as { last_updated?: string } | null)?.last_updated ?? null,
      stale: true,
      lastKnownBalance,
      error: 'Live KudiSMS balance could not be loaded',
    };
  }
}
