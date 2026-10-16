import { getKudiBalance, updateKudiBalance } from '@/lib/pin-utils';

export async function getLiveBalance() {
  const stored = await getKudiBalance();
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
    return { balance, lastUpdated: new Date().toISOString(), stale: false };
  } catch {
    return { balance: Number(stored?.balance ?? 0), lastUpdated: stored?.last_updated ?? null, stale: true };
  }
}
