'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { usePinAuthorization } from '@/hooks/use-pin-authorization';
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  Check,
  CheckCircle2,
  ChevronDown,
  Landmark,
  Loader2,
  Lock,
  Search,
  ShieldCheck,
  User,
} from 'lucide-react';

interface Bank {
  id: number;
  code: string;
  name: string;
}

interface BankDetails {
  bank_code: string;
  bank_account_number: string;
  bank_account_holder: string;
}

export default function BankDetailsPage() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [bankSearch, setBankSearch] = useState('');
  const [validating, setValidating] = useState(false);
  const { authorize, dialogs } = usePinAuthorization();

  const [bankDetails, setBankDetails] = useState<BankDetails>({
    bank_code: '',
    bank_account_number: '',
    bank_account_holder: '',
  });

  const [hasSavedDetails, setHasSavedDetails] = useState(false);
  const [accountValidated, setAccountValidated] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [banksRes, detailsRes] = await Promise.all([
        fetch('/api/paystack/banks', { credentials: 'include' }),
        fetch('/api/business/bank-details', { credentials: 'include' }),
      ]);

      if (banksRes.ok) {
        const data = await banksRes.json();
        setBanks(data.banks || []);
      }

      if (detailsRes.ok) {
        const data = await detailsRes.json();
        if (data.bank_code) {
          setBankDetails({
            bank_code: data.bank_code,
            bank_account_number: data.bank_account_number || '',
            bank_account_holder: data.bank_account_holder || '',
          });
          setAccountValidated(!!data.bank_account_holder);
          setHasSavedDetails(!!data.bank_account_holder);
        }
      }

      setError('');
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load bank data');
    } finally {
      setLoading(false);
    }
  };

  const validateAccountNumber = async () => {
    if (!bankDetails.bank_account_number || !bankDetails.bank_code) {
      setError('Please select a bank and enter your account number');
      return;
    }

    setValidating(true);
    setError('');

    try {
const response = await fetch('/api/paystack/validate-account', {
      method: 'POST',
      credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountNumber: bankDetails.bank_account_number,
          bankCode: bankDetails.bank_code,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Account validation failed');
        return;
      }

      setBankDetails((prev) => ({
        ...prev,
        bank_account_holder: data.account_name,
      }));

      setAccountValidated(true);
      setError('');
    } catch (err) {
      console.error('Validation error:', err);
      setError('Failed to validate account');
    } finally {
      setValidating(false);
    }
  };

  const handleSaveBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bankDetails.bank_code) {
      setError('Please select a bank');
      return;
    }

    if (!bankDetails.bank_account_number) {
      setError('Please enter account number');
      return;
    }

    if (!bankDetails.bank_account_holder) {
      setError('Please verify your account first');
      return;
    }

    setError('');
    try {
      const ticket = await authorize('bank_account', { bank_code: bankDetails.bank_code, account_number: bankDetails.bank_account_number }, 'Confirm bank account change');
      await handlePinVerified(ticket);
    } catch (err) {
      if (err instanceof Error && err.message === 'cancelled') return;
      setError(err instanceof Error ? err.message : 'PIN authorization failed');
    }
  };

  const handlePinVerified = async (authorizationTicket: string) => {
    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/business/bank-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bank_code: bankDetails.bank_code,
          bank_account_number: bankDetails.bank_account_number,
          authorizationTicket,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save bank details');
      }

      const refreshed = await fetch('/api/business/bank-details', { credentials: 'include' });
      if (refreshed.ok) { const data = await refreshed.json(); setBankDetails((current) => ({ ...current, bank_account_holder: data.bank_account_holder || current.bank_account_holder })); }
      setSuccess('Bank details saved successfully! Your account is now verified.');
      setHasSavedDetails(true);
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      console.error('Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save bank details');
    } finally {
      setSaving(false);
    }
  };

  const selectedBank = banks.find((b) => b.code === bankDetails.bank_code);

  const filteredBanks = useMemo(() => {
    if (!bankSearch) return banks;
    const q = bankSearch.toLowerCase();
    return banks.filter((b) => b.name.toLowerCase().includes(q));
  }, [banks, bankSearch]);

  const maskedAccount = bankDetails.bank_account_number
    ? `••••${bankDetails.bank_account_number.slice(-4)}`
    : '';

  if (loading) {
    return (
      <div className="space-y-6">
        <Header />
        <div className="flex h-72 items-center justify-center rounded-2xl border border-border bg-muted/20">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading bank details…
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Header />

      {dialogs}

      {/* Status hero */}
      <section
        className={`relative overflow-hidden rounded-2xl border p-5 sm:p-6 ${
          hasSavedDetails
            ? 'border-emerald-200 bg-gradient-to-br from-emerald-50 to-white'
            : 'border-amber-200 bg-gradient-to-br from-amber-50 to-white'
        }`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                hasSavedDetails
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-500 text-white'
              }`}
            >
              {hasSavedDetails ? (
                <ShieldCheck className="h-5 w-5" />
              ) : (
                <AlertCircle className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Payout account
              </p>
              <h2 className="text-lg font-bold text-foreground sm:text-xl">
                {hasSavedDetails
                  ? 'Your bank account is verified'
                  : 'Add your bank account to start receiving payouts'}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                {hasSavedDetails
                  ? 'Withdrawals from your wallet will be sent to this account.'
                  : 'You only need to do this once. We verify the account with Paystack before saving.'}
              </p>
            </div>
          </div>

          {hasSavedDetails && selectedBank && (
            <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-right shadow-sm">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                On file
              </p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                {selectedBank.name}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {maskedAccount}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Alerts */}
      {error && (
        <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" />
          <p className="text-sm font-medium text-emerald-800">{success}</p>
        </div>
      )}

      <form onSubmit={handleSaveBankDetails} className="grid gap-6 lg:grid-cols-3">
        {/* Form column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Bank selection card */}
          <div className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-2">
              <Landmark className="h-5 w-5 text-primary" />
              <h3 className="text-base font-semibold text-foreground">
                Bank account
              </h3>
            </div>

            <div className="space-y-5">
              {/* Bank picker */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Bank <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowBankDropdown((v) => !v)}
                    className="flex h-12 w-full items-center justify-between rounded-lg border border-border bg-background px-3.5 text-sm transition-colors hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <span
                      className={
                        selectedBank ? 'text-foreground' : 'text-muted-foreground'
                      }
                    >
                      {selectedBank?.name || 'Select your bank'}
                    </span>
                    <ChevronDown
                      className={`h-4 w-4 text-muted-foreground transition-transform ${
                        showBankDropdown ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {showBankDropdown && (
                    <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                      <div className="relative border-b border-border bg-muted/40 p-2">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <input
                          autoFocus
                          value={bankSearch}
                          onChange={(e) => setBankSearch(e.target.value)}
                          placeholder="Search banks…"
                          className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </div>
                      <ul className="max-h-72 overflow-y-auto py-1">
                        {filteredBanks.length === 0 && (
                          <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                            No banks match “{bankSearch}”
                          </li>
                        )}
                        {filteredBanks.map((bank) => {
                          const active = bank.code === bankDetails.bank_code;
                          return (
                            <li key={bank.code}>
                              <button
                                type="button"
                                onClick={() => {
                                  setBankDetails({
                                    ...bankDetails,
                                    bank_code: bank.code,
                                  });
                                  setShowBankDropdown(false);
                                  setBankSearch('');
                                  setAccountValidated(false);
                                }}
                                className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm transition-colors ${
                                  active
                                    ? 'bg-primary/10 text-primary'
                                    : 'text-foreground hover:bg-muted/40'
                                }`}
                              >
                                <span className="truncate">{bank.name}</span>
                                {active && <Check className="h-4 w-4 shrink-0" />}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Account number */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">
                  Account number <span className="text-destructive">*</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  value={bankDetails.bank_account_number}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '');
                    setBankDetails({
                      ...bankDetails,
                      bank_account_number: digits,
                      bank_account_holder: '',
                    });
                    setAccountValidated(false);
                  }}
                  placeholder="0123456789"
                  className="h-12 w-full rounded-lg border border-border bg-background px-3.5 font-mono text-sm tracking-wide text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  10-digit NUBAN account number
                </p>
              </div>

              {/* Verify button */}
              <button
                type="button"
                onClick={validateAccountNumber}
                disabled={
                  !bankDetails.bank_account_number ||
                  bankDetails.bank_account_number.length < 10 ||
                  !bankDetails.bank_code ||
                  validating ||
                  accountValidated
                }
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {validating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying with Paystack…
                  </>
                ) : accountValidated ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Account verified
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Verify account
                  </>
                )}
              </button>

              {/* Account holder reveal */}
              {bankDetails.bank_account_holder && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
                      <User className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                        Account holder
                      </p>
                      <p className="truncate text-base font-semibold text-foreground">
                        {bankDetails.bank_account_holder}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {selectedBank?.name} •{' '}
                        <span className="font-mono">
                          {bankDetails.bank_account_number}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action row */}
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <Link href="/dashboard/profile" className="sm:w-32">
              <Button
                type="button"
                variant="outline"
                className="h-12 w-full text-sm font-medium"
              >
                Cancel
              </Button>
            </Link>
            <button
              type="submit"
              disabled={saving || !accountValidated}
              className="flex h-12 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none sm:min-w-[200px]"
            >
              {saving ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Banknote className="h-5 w-5" />
                  {hasSavedDetails ? 'Update details' : 'Save bank details'}
                </>
              )}
            </button>
          </div>
        </div>

        {/* Side column */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <h4 className="text-sm font-semibold text-foreground">
                How verification works
              </h4>
            </div>
            <ol className="space-y-3 text-sm text-muted-foreground">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  1
                </span>
                <span>Pick your bank and enter your 10-digit account number.</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  2
                </span>
                <span>
                  We verify with Paystack and pull the official account name.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  3
                </span>
                <span>Save once — every withdrawal goes to this account.</span>
              </li>
            </ol>
          </div>

          <div className="rounded-2xl border border-border bg-muted/30 p-5">
            <div className="mb-2 flex items-center gap-2">
              <Lock className="h-4 w-4 text-muted-foreground" />
              <h4 className="text-sm font-semibold text-foreground">
                Your details are safe
              </h4>
            </div>
            <p className="text-xs text-muted-foreground">
              We never store full card data, and account numbers are only used to
              create a Paystack transfer recipient. You can update them at any
              time.
            </p>
          </div>
        </aside>
      </form>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-2">
      <Link href="/dashboard/profile">
        <Button variant="outline" size="sm" className="h-8">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
      </Link>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Bank details
        </h1>
        <p className="text-sm text-muted-foreground">
          Where your withdrawals are paid out
        </p>
      </div>
    </div>
  );
}
