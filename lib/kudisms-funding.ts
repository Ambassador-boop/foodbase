import { getBanks } from '@/lib/banks';

/**
 * KudiSMS charges VAT on every payment into its virtual account. This is the
 * rate used only to *estimate* what lands in the SMS wallet, never to change
 * the amount we send.
 */
export const KUDISMS_VAT_RATE = 0.075;

/** Below this live SMS balance the admin console warns. */
export const SMS_LOW_BALANCE_THRESHOLD = 100;

/** The smallest funding transfer the API accepts. */
export const SMS_MIN_FUNDING = 1000;

/** A second funding submit inside this window is refused while one is in flight. */
export const SMS_PENDING_WINDOW_MINUTES = 2;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * A display-only estimate of what a transfer of `amount` adds to the SMS wallet
 * after KudiSMS VAT. The transfer itself is unchanged.
 */
export function estimateSmsWalletCredit(amount: number) {
  const send = Number.isFinite(amount) && amount > 0 ? round2(amount) : 0;
  const vat = round2(send * KUDISMS_VAT_RATE);
  return { send, vat, credit: round2(send - vat), vatRate: KUDISMS_VAT_RATE };
}

/** `0123456789` -> `••••6789`. */
export function maskAccountNumber(value: string | null | undefined): string | null {
  const digits = String(value ?? '').trim();
  if (!digits) return null;
  if (digits.length <= 4) return '••••';
  return `••••${digits.slice(-4)}`;
}

/** Keeps the initial of each word, e.g. `KudiSMS Limited` -> `K•••••• L••••••`. */
export function maskName(value: string | null | undefined): string | null {
  const name = String(value ?? '').trim();
  if (!name) return null;
  return name
    .split(/\s+/)
    .map((word) => `${word.charAt(0)}${'•'.repeat(Math.max(3, Math.min(8, word.length - 1)))}`)
    .join(' ');
}

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

export type FundingSetupCheck = {
  configured: boolean;
  accountNumber: { set: boolean; valid: boolean; masked: string | null };
  expectedName: { set: boolean; masked: string | null };
  resolved: { ok: boolean; masked: string | null; bankName: string | null; error: string | null };
  nameMatches: 'match' | 'mismatch' | 'not_configured' | 'unresolved';
};

/**
 * Read-only view of the funding configuration for the admin console. Every
 * value is masked; it only reports whether things are set and whether the
 * resolved account name agrees with the configured expectation.
 */
export async function getFundingSetupCheck(): Promise<FundingSetupCheck> {
  const accountNumber = process.env.KUDISMS_FUNDING_ACCOUNT_NUMBER || '';
  const expected = process.env.KUDISMS_FUNDING_EXPECTED_NAME || '';
  const target = await getFundingTarget();
  const resolvedName = target.configured ? target.accountName ?? null : null;

  let nameMatches: FundingSetupCheck['nameMatches'] = 'not_configured';
  if (expected && resolvedName) {
    nameMatches = resolvedName.toLowerCase().includes(expected.toLowerCase()) ? 'match' : 'mismatch';
  } else if (expected && !resolvedName) {
    nameMatches = 'unresolved';
  }

  return {
    configured: target.configured,
    accountNumber: { set: accountNumber.length > 0, valid: /^\d{10}$/.test(accountNumber), masked: maskAccountNumber(accountNumber) },
    expectedName: { set: expected.length > 0, masked: maskName(expected) },
    resolved: {
      ok: Boolean(resolvedName),
      masked: maskName(resolvedName),
      bankName: target.bankName ?? null,
      error: target.configured ? null : target.error ?? null,
    },
    nameMatches,
  };
}
