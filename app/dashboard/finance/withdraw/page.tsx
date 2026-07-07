'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { PinModal } from '@/components/pin-modal';
import { usePinVerification } from '@/hooks/use-pin-verification';
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  BadgeCheck,
  Building2,
  Info,
  Loader2,
  ShieldCheck,
  Wallet,
} from 'lucide-react';

const PAYSTACK_MIN_NGN = 100;
const FREE_DAILY_WITHDRAWALS = 3;
const OVERAGE_FEE_NGN = 500;

interface Business {
  available_balance: number;
  pending_balance: number;
}
interface BankDetails {
  bank_code: string;
  bank_account_number: string;
  bank_account_holder: string;
}
interface Bank {
  code: string;
  name: string;
}

const NGN = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(
    Number.isFinite(n) ? n : 0,
  );

export default function WithdrawPage() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [bankNameMap, setBankNameMap] = useState<Record<string, string>>({});
  const [todayCount, setTodayCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pinRequired, setPinRequired] = useState(false);
  const [verificationInfo, setVerificationInfo] = useState<{ method?: string; message?: string } | null>(null);

  const pinVerification = usePinVerification();

  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');

  /* -------- bootstrap ------------------------------------------- */
  useEffect(() => {
    (async () => {
      try {
        const [bRes, bdRes, banksRes, wRes] = await Promise.all([
          fetch('/api/business', { credentials: 'include' }),
          fetch('/api/business/bank-details', { credentials: 'include' }),
          fetch('/api/paystack/banks'),
          fetch('/api/business/withdrawals', { credentials: 'include' }),
        ]);

        if (bRes.ok) {
          const d = await bRes.json();
          setBusiness(d.business);
        }
        if (bdRes.ok) {
          const d = await bdRes.json();
          if (d.bank_code && d.bank_account_number && d.bank_account_holder) {
            setBankDetails({
              bank_code: d.bank_code,
              bank_account_number: d.bank_account_number,
              bank_account_holder: d.bank_account_holder,
            });
          }
        }
        if (banksRes.ok) {
          const d = await banksRes.json();
          const map: Record<string, string> = {};
          for (const b of d.banks || []) map[String(b.code)] = b.name;
          setBankNameMap(map);
        }
        if (wRes.ok) {
          const list: any[] = await wRes.json();
          const startOfDay = new Date();
          startOfDay.setHours(0, 0, 0, 0);
          const count = list.filter(
            (w: any) =>
              new Date(w.created_at).getTime() >= startOfDay.getTime() &&
              !['failed', 'rejected', 'abandoned', 'blocked'].includes(
                String(w.status),
              ),
          ).length;
          setTodayCount(count);
        }
      } catch (err) {
        console.error('[v0] withdraw bootstrap error:', err);
        setError('Failed to load withdrawal data');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* -------- derived --------------------------------------------- */
  const bankName = useMemo(
    () =>
      bankDetails
        ? bankNameMap[bankDetails.bank_code] || `Bank ${bankDetails.bank_code}`
        : '',
    [bankDetails, bankNameMap],
  );

  const withdrawNum = parseFloat(amount) || 0;
  const incursOverage = todayCount >= FREE_DAILY_WITHDRAWALS;
  const fee = incursOverage ? OVERAGE_FEE_NGN : 0;
  const totalDeduction = withdrawNum + fee;
  const balance = business?.available_balance ?? 0;
  const remaining = Math.max(0, balance - totalDeduction);
  const remainingFreeToday = Math.max(
    0,
    FREE_DAILY_WITHDRAWALS - todayCount,
  );

  const validation = (() => {
    if (!withdrawNum) return null;
    if (withdrawNum < PAYSTACK_MIN_NGN)
      return `Minimum withdrawal is ${NGN(PAYSTACK_MIN_NGN)}`;
    if (totalDeduction > balance) return 'Insufficient balance for this withdrawal';
    return null;
  })();

  /* -------- submit ---------------------------------------------- */
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankDetails || !business) return;
    if (validation) {
      setError(validation);
      return;
    }

    // Request PIN before processing withdrawal
    setPinRequired(true);
    setError('');
    
    try {
      const result = await pinVerification.requestPin('withdrawal', {
        amount: withdrawNum,
        bank_code: bankDetails.bank_code,
        bank_account_holder: bankDetails.bank_account_holder,
      });
      setVerificationInfo({ method: result.method, message: result.message });
    } catch (err) {
      console.error('[v0] PIN request error:', err);
      setError('Failed to send verification PIN. Please try again.');
      setPinRequired(false);
    }
  };

  const handlePinVerified = async () => {
    if (!bankDetails || !business) return;
    
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/business/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount: withdrawNum,
          bank_code: bankDetails.bank_code,
          bank_account_number: bankDetails.bank_account_number,
          bank_account_holder: bankDetails.bank_account_holder,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Withdrawal failed');
      setPinRequired(false);
      pinVerification.closeModal();
      router.push(`/dashboard/finance/withdrawal/${data.withdrawalId}`);
    } catch (err: any) {
      console.error('[v0] withdraw submit error:', err);
      setError(err?.message || 'Failed to create withdrawal');
      setSubmitting(false);
    }
  };

  /* -------- loading --------------------------------------------- */
  if (loading) {
    return (
      <div className="space-y-4">
        <Header />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl bg-muted/60"
            />
          ))}
        </div>
      </div>
    );
  }

  /* -------- no bank details ------------------------------------- */
  if (!bankDetails) {
    return (
      <div className="space-y-4">
        <Header />
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Building2 className="h-7 w-7 text-primary" />
          </div>
          <h2 className="mt-4 text-lg font-semibold">Bank details required</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your business bank account so we know where to send your money.
          </p>
          <Link
            href="/dashboard/profile/bank-details"
            className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Add bank details
          </Link>
        </div>
      </div>
    );
  }

  /* -------- main UI --------------------------------------------- */
  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <Header />

      {/* PIN Verification Modal */}
      {pinRequired && (
        <PinModal
          isOpen={pinVerification.isOpen}
          onClose={() => {
            setPinRequired(false);
            pinVerification.closeModal();
            setVerificationInfo(null);
          }}
          onSubmit={async (pin) => {
            try {
              await pinVerification.verifyPin(pin);
              await handlePinVerified();
            } catch (err) {
              console.error('PIN verification error:', err);
              setError('Invalid PIN. Please try again.');
            }
          }}
          purpose="withdrawal"
          pinId={pinVerification.pinId}
          isLoading={submitting}
          method={verificationInfo?.method as any}
          message={verificationInfo?.message}
        />
      )}

      {/* Verification info message */}
      {pinRequired && verificationInfo?.message && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {verificationInfo.message}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Balance hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/95 via-primary to-primary/80 p-5 text-primary-foreground shadow-lg">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-primary-foreground/80">
          <Wallet className="h-3.5 w-3.5" /> Available balance
        </p>
        <p className="mt-2 text-3xl font-bold leading-none md:text-4xl">
          {NGN(business?.available_balance ?? 0)}
        </p>
        <p className="mt-2 text-xs text-primary-foreground/80">
          Pending settlement: {NGN(business?.pending_balance ?? 0)}
        </p>
      </div>

      {/* Daily count notice */}
      <div
        className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${
          incursOverage
            ? 'border-amber-200 bg-amber-50 text-amber-800'
            : 'border-emerald-200 bg-emerald-50 text-emerald-800'
        }`}
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="flex-1">
          {incursOverage ? (
            <>
              You&apos;ve made {todayCount} withdrawals today. Each additional
              withdrawal will be charged a flat{' '}
              <span className="font-semibold">{NGN(OVERAGE_FEE_NGN)}</span> fee.
            </>
          ) : (
            <>
              <span className="font-semibold">
                {remainingFreeToday} free withdrawal
                {remainingFreeToday === 1 ? '' : 's'}
              </span>{' '}
              left today. After that, a flat {NGN(OVERAGE_FEE_NGN)} fee applies
              per withdrawal.
            </>
          )}
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5">
        {/* Bank account card */}
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              Withdrawing to
            </h2>
            <Link href="/dashboard/profile/bank-details">
              <Button variant="outline" size="sm" className="h-7 text-xs">
                Change
              </Button>
            </Link>
          </div>
          <div className="space-y-1 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="truncate text-base font-semibold">{bankName}</p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                <BadgeCheck className="h-3 w-3" />
                Verified
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {bankDetails.bank_account_holder}
            </p>
            <p className="font-mono text-sm tracking-wide text-foreground">
              {bankDetails.bank_account_number}
            </p>
          </div>
        </section>

        {/* Amount card */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Withdrawal amount</h2>
          <div className="mt-3">
            <label htmlFor="amount" className="sr-only">
              Amount
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-muted-foreground">
                ₦
              </span>
              <input
                id="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={PAYSTACK_MIN_NGN}
                max={balance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="block w-full rounded-xl border border-border bg-background px-10 py-4 text-2xl font-bold tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Quick chips */}
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { label: '25%', v: balance * 0.25 },
                { label: '50%', v: balance * 0.5 },
                { label: '75%', v: balance * 0.75 },
                { label: 'Max', v: Math.max(0, balance - fee) },
              ].map((q) => (
                <button
                  key={q.label}
                  type="button"
                  onClick={() => setAmount(q.v.toFixed(2))}
                  disabled={balance <= 0}
                  className="rounded-full border border-border bg-muted/40 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {q.label}
                </button>
              ))}
            </div>

            <p className="mt-2 text-xs text-muted-foreground">
              Min {NGN(PAYSTACK_MIN_NGN)} · Max {NGN(balance)}
            </p>
          </div>

          {/* Notes */}
          <div className="mt-5">
            <label
              htmlFor="notes"
              className="mb-1.5 block text-xs font-medium text-foreground"
            >
              Note (optional)
            </label>
            <input
              id="notes"
              type="text"
              maxLength={120}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Weekly payout"
              className="block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </section>

        {/* Summary */}
        {withdrawNum > 0 && (
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold">Transaction summary</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">Withdrawal amount</dt>
                <dd className="font-medium tabular-nums">
                  {NGN(withdrawNum)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted-foreground">
                  Withdrawal fee
                  {incursOverage && (
                    <span className="ml-1 text-[10px] text-amber-700">
                      (4th+ today)
                    </span>
                  )}
                </dt>
                <dd
                  className={`font-medium tabular-nums ${
                    fee > 0 ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  {fee > 0 ? `−${NGN(fee)}` : 'Free'}
                </dd>
              </div>
              <div className="my-2 border-t border-dashed border-border" />
              <div className="flex items-center justify-between">
                <dt className="font-semibold">You&apos;ll receive</dt>
                <dd className="text-base font-bold tabular-nums text-primary">
                  {NGN(withdrawNum)}
                </dd>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <dt>Total deducted from balance</dt>
                <dd className="tabular-nums">{NGN(totalDeduction)}</dd>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <dt>Remaining available balance</dt>
                <dd className="tabular-nums">{NGN(remaining)}</dd>
              </div>
            </dl>
            {validation && (
              <p className="mt-3 flex items-center gap-1 text-xs text-rose-600">
                <AlertCircle className="h-3 w-3" />
                {validation}
              </p>
            )}
          </section>
        )}

        {/* Trust note */}
        <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <p>
            Transfers are processed securely by Paystack. Funds typically
            arrive in seconds, but may take up to a few minutes during peak
            hours.
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/dashboard/finance" className="sm:w-32">
            <Button variant="outline" className="h-12 w-full text-sm font-medium">
              Cancel
            </Button>
          </Link>
          <button
            type="submit"
            disabled={
              submitting ||
              !withdrawNum ||
              !!validation ||
              balance <= 0 ||
              !bankDetails
            }
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing transfer…
              </>
            ) : (
              <>
                <Banknote className="h-5 w-5" />
                Confirm withdrawal
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-center gap-2">
      <Link href="/dashboard/finance">
        <Button variant="outline" size="sm" className="h-8">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Withdraw funds</h1>
    </div>
  );
}
