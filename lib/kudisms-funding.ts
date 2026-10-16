import { getBanks } from '@/lib/banks';

export type FundingTarget = { configured: boolean; bankName?: string; bankCode?: string; accountNumberMasked?: string; accountName?: string; error?: string };
let cached: { at: number; value: FundingTarget } | null = null;
const ttl = 12 * 60 * 60 * 1000;

export async function getFundingTarget(): Promise<FundingTarget> {
  if (cached && Date.now() - cached.at < ttl) return cached.value;
  const accountNumber = process.env.KUDISMS_FUNDING_ACCOUNT_NUMBER || '';
  if (!/^\d{10}$/.test(accountNumber)) return { configured: false, error: 'KudiSMS funding account is not configured with a valid 10-digit account number' };
  try {
    const banks = await getBanks(); const entry = [...banks.entries()].find(([, name]) => /titan/i.test(name));
    if (!entry) return { configured: false, error: 'Titan bank was not found in the Paystack bank list' };
    const [bankCode, bankName] = entry;
    const response = await fetch(`https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${encodeURIComponent(bankCode)}`, { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` }, cache: 'no-store' });
    const body = await response.json(); const accountName = body?.data?.account_name;
    const expected = process.env.KUDISMS_FUNDING_EXPECTED_NAME;
    if (!response.ok || !body?.status || !accountName) return { configured: false, error: 'KudiSMS funding account could not be resolved' };
    if (expected && !String(accountName).toLowerCase().includes(expected.toLowerCase())) return { configured: false, error: 'Resolved funding account name does not match the configured expected name' };
    const value = { configured: true, bankName, bankCode, accountNumberMasked: `••••${accountNumber.slice(-4)}`, accountName };
    cached = { at: Date.now(), value }; return value;
  } catch { return { configured: false, error: 'KudiSMS funding account could not be verified' }; }
}
