'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Building2,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  CreditCard,
  Hash,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Undo2,
  XCircle,
} from 'lucide-react';
import { formatWat } from '@/lib/wat';

interface Withdrawal {
  id: string;
  amount: number;
  net_amount?: number | null;
  withdrawal_fee?: number;
  service_fee?: number;
  status: string;
  bank_code?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  reference?: string;
  payment_reference?: string;
  transfer_code?: string;
  paystack_transfer_id?: string;
  gateway_response?: string;
  failure_reason?: string;
  notes?: string;
  requested_at?: string;
  processed_at?: string;
  created_at: string;
  updated_at: string;
  balance_reversed?: boolean;
}

const NGN = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(
    Number.isFinite(n) ? n : 0,
  );

/* Map of paystack transfer status → display config */
const STATUS_CONFIG: Record<
  string,
  { label: string; tone: string; icon: any; description: string }
> = {
  success: {
    label: 'Successful',
    tone: 'emerald',
    icon: CheckCircle2,
    description:
      'Your withdrawal has been processed successfully. Funds should reflect in your bank account shortly.',
  },
  pending: {
    label: 'Processing',
    tone: 'amber',
    icon: Loader2,
    description:
      'Paystack is queuing this transfer with the receiving bank. This usually takes a few seconds.',
  },
  otp: {
    label: 'OTP required',
    tone: 'amber',
    icon: ShieldCheck,
    description:
      'An OTP has been sent. Please complete OTP verification to continue.',
  },
  received: {
    label: 'Awaiting approval',
    tone: 'amber',
    icon: Clock,
    description: 'Awaiting server approval before processing continues.',
  },
  reversed: {
    label: 'Reversed',
    tone: 'rose',
    icon: RefreshCw,
    description:
      "The recipient bank couldn't accept this transfer. The amount has been credited back to your balance — you can retry later.",
  },
  failed: {
    label: 'Failed',
    tone: 'rose',
    icon: XCircle,
    description:
      'This transfer could not be completed. The amount has been returned to your available balance.',
  },
  abandoned: {
    label: 'Abandoned',
    tone: 'rose',
    icon: XCircle,
    description: 'OTP was not provided in time. Please initiate a new withdrawal.',
  },
  blocked: {
    label: 'Blocked',
    tone: 'rose',
    icon: XCircle,
    description: 'Approval failed. Please contact support if this persists.',
  },
  rejected: {
    label: 'Rejected',
    tone: 'rose',
    icon: XCircle,
    description: 'The transfer was rejected during approval.',
  },
};

const TONE_CLS: Record<string, { bg: string; text: string; ring: string; soft: string }> = {
  emerald: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-700',
    ring: 'ring-emerald-200',
    soft: 'bg-emerald-50',
  },
  amber: {
    bg: 'bg-amber-100',
    text: 'text-amber-700',
    ring: 'ring-amber-200',
    soft: 'bg-amber-50',
  },
  rose: {
    bg: 'bg-rose-100',
    text: 'text-rose-700',
    ring: 'ring-rose-200',
    soft: 'bg-rose-50',
  },
};

export default function WithdrawalDetailsPage() {
  const params = useParams();
  const withdrawalId = params.withdrawalId as string;

  const [w, setW] = useState<Withdrawal | null>(null);
  const [bankNameMap, setBankNameMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/withdrawals/${withdrawalId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Withdrawal not found');
      const data = await res.json();
      setW(data);
      setError('');
      
      // Trigger reconciliation if withdrawal has a terminal failed status
      if (['failed', 'reversed', 'abandoned', 'blocked', 'rejected'].includes(
        String(data.status).toLowerCase()
      )) {
        fetch('/api/business/reconcile-withdrawals', {
          method: 'POST',
          credentials: 'include',
        }).catch(() => {});
      }
    } catch (err: any) {
      console.error('[v0] withdrawal detail error:', err);
      setError(err?.message || 'Failed to load withdrawal');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!withdrawalId) return;
    fetchData();
    fetch('/api/paystack/banks', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.banks) return;
        const map: Record<string, string> = {};
        for (const b of d.banks) map[String(b.code)] = b.name;
        setBankNameMap(map);
      })
      .catch(() => {});
    // Auto-refresh while still pending
    const id = setInterval(() => {
      setW((curr) => {
        if (
          curr &&
          ['pending', 'otp', 'received', 'queued'].includes(
            String(curr.status).toLowerCase(),
          )
        ) {
          fetchData();
        }
        return curr;
      });
    }, 6000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [withdrawalId]);

  const bankName = useMemo(
    () => (w?.bank_code ? bankNameMap[w.bank_code] : ''),
    [w?.bank_code, bankNameMap],
  );

  const status = String(w?.status || 'pending').toLowerCase();
  const cfg =
    STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const tone = TONE_CLS[cfg.tone];

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1200);
    } catch {}
  };

  /* ---------- timeline construction ----------------------------- */
  const timeline = useMemo(() => {
    if (!w) return [];
    const isFailed = ['failed', 'reversed', 'abandoned', 'blocked', 'rejected'].includes(
      status,
    );
    const isSuccess = status === 'success';

    const steps: Array<{
      key: string;
      title: string;
      description: string;
      at?: string;
      state: 'done' | 'active' | 'pending' | 'failed';
    }> = [
      {
        key: 'requested',
        title: 'Withdrawal requested',
        description: 'You initiated this withdrawal from your dashboard.',
        at: w.requested_at || w.created_at,
        state: 'done',
      },
      {
        key: 'recipient',
        title: 'Beneficiary verified',
        description: 'Bank account verified and transfer recipient created on Paystack.',
        at: w.created_at,
        state: 'done',
      },
      {
        key: 'queued',
        title: 'Queued at Paystack',
        description: 'Transfer queued and is awaiting the receiving bank.',
        at: w.created_at,
        state: isFailed ? 'done' : isSuccess ? 'done' : 'active',
      },
      {
        key: 'processing',
        title: 'Processing with bank',
        description:
          'The processor is sending funds to the receiving bank. This usually takes seconds.',
        at: !isFailed && !isSuccess ? undefined : w.updated_at,
        state: isFailed
          ? 'failed'
          : isSuccess
            ? 'done'
            : status === 'pending'
              ? 'active'
              : 'pending',
      },
      {
        key: 'final',
        title: isSuccess
          ? 'Funds delivered'
          : isFailed
            ? 'Transfer ended'
            : 'Awaiting confirmation',
        description: isSuccess
          ? 'Funds have been credited to the recipient bank.'
          : isFailed
            ? cfg.description
            : 'We will update this page automatically once the bank confirms.',
        at: w.processed_at || (isSuccess || isFailed ? w.updated_at : undefined),
        state: isSuccess ? 'done' : isFailed ? 'failed' : 'pending',
      },
    ];
    return steps;
  }, [w, status, cfg.description]);

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

  if (!w) {
    return (
      <div className="space-y-4">
        <Header />
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
          <p className="mt-2 text-sm text-rose-700">
            {error || 'Withdrawal not found'}
          </p>
        </div>
      </div>
    );
  }

  const StatusIcon = cfg.icon;
  const fee = Number(w.withdrawal_fee || 0);

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <Header
        right={
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={refreshing}
            className="h-8 gap-1.5"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>
        }
      />

      {/* Status hero */}
      <div
        className={`relative overflow-hidden rounded-2xl border ${tone.ring} ${tone.soft} p-5 shadow-sm`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone.bg} ${tone.text}`}
          >
            <StatusIcon
              className={`h-6 w-6 ${
                status === 'pending' ? 'animate-spin' : ''
              }`}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Withdrawal status
            </p>
            <p className={`mt-1 text-xl font-bold ${tone.text}`}>{cfg.label}</p>
            <p className="mt-1 text-xs text-muted-foreground md:text-sm">
              {cfg.description}
            </p>
            {w.gateway_response && (
              <p className="mt-2 rounded-lg bg-white/70 p-2 text-[11px] text-muted-foreground">
                Gateway: {w.gateway_response}
              </p>
            )}
            {w.failure_reason && (
              <p className="mt-2 rounded-lg bg-white/70 p-2 text-[11px] text-rose-700">
                {w.failure_reason}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Balance reversed notification */}
      {w.balance_reversed && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200/60 bg-emerald-50/60 p-4">
          <Undo2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-emerald-700">Balance reversed</p>
            <p className="mt-1 text-xs text-emerald-700/80">
              The withdrawal amount plus fee ({NGN(Number(w.amount) + Number(w.withdrawal_fee || 0))}) has been returned to your available balance.
            </p>
          </div>
        </div>
      )}

      {/* Amount summary card */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="text-center">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Amount sent
          </p>
          <p className="mt-2 text-4xl font-bold tabular-nums">
            {NGN(Number(w.amount))}
          </p>
          {fee > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              + {NGN(fee)} withdrawal fee
            </p>
          )}
        </div>

        <dl className="mt-5 grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
          <Stat label="Withdrawal" value={NGN(Number(w.amount))} />
          <Stat
            label="Fee"
            value={fee > 0 ? NGN(fee) : 'Free'}
            tone={fee > 0 ? 'rose' : 'emerald'}
          />
          <Stat label="Recipient gets" value={NGN(Number(w.amount))} tone="emerald" />
        </dl>
      </section>

      {/* Timeline */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold">Transfer timeline</h2>
        <ol className="mt-4 space-y-4">
          {timeline.map((step, i) => {
            const isLast = i === timeline.length - 1;
            const dotCls =
              step.state === 'done'
                ? 'bg-emerald-500 text-white'
                : step.state === 'active'
                  ? 'bg-amber-500 text-white'
                  : step.state === 'failed'
                    ? 'bg-rose-500 text-white'
                    : 'bg-muted text-muted-foreground';
            const Icon =
              step.state === 'done'
                ? CheckCircle2
                : step.state === 'active'
                  ? Loader2
                  : step.state === 'failed'
                    ? XCircle
                    : Circle;
            return (
              <li key={step.key} className="relative flex gap-3 pl-1">
                {!isLast && (
                  <span
                    aria-hidden
                    className="absolute left-[15px] top-7 h-[calc(100%-12px)] w-px bg-border"
                  />
                )}
                <div
                  className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${dotCls}`}
                >
                  <Icon
                    className={`h-4 w-4 ${
                      step.state === 'active' ? 'animate-spin' : ''
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1 pb-2">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {step.description}
                  </p>
                  {step.at && (
                    <p className="mt-1 text-[11px] text-muted-foreground/80">
                      {formatWat(step.at, {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true,
                      })}{' '}
                      WAT
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Beneficiary */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Beneficiary</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="truncate text-base font-semibold">
                {bankName || `Bank ${w.bank_code || ''}`}
              </p>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                <BadgeCheck className="h-3 w-3" />
                Verified
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {w.bank_account_holder || '—'}
            </p>
            {w.bank_account_number && (
              <p className="mt-0.5 font-mono text-sm">
                {w.bank_account_number}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Identifiers */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Hash className="h-4 w-4 text-muted-foreground" />
          Reference details
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Identifier
            label="Withdrawal ID"
            value={w.id}
            onCopy={() => copy('Withdrawal ID', w.id)}
            copied={copied === 'Withdrawal ID'}
          />
          {(w.reference || w.payment_reference) && (
            <Identifier
              label="Transfer reference"
              value={(w.reference || w.payment_reference) as string}
              mono
              onCopy={() =>
                copy(
                  'Transfer reference',
                  (w.reference || w.payment_reference) as string,
                )
              }
              copied={copied === 'Transfer reference'}
            />
          )}
          {w.transfer_code && (
            <Identifier
              label="Transfer code"
              value={w.transfer_code}
              mono
              onCopy={() => copy('Transfer code', w.transfer_code as string)}
              copied={copied === 'Transfer code'}
            />
          )}
          <Identifier
            label="Created"
            value={`${formatWat(w.created_at, {
              year: 'numeric',
              month: 'short',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
            })} WAT`}
          />
          {w.processed_at && (
            <Identifier
              label="Processed"
              value={`${formatWat(w.processed_at, {
                year: 'numeric',
                month: 'short',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
              })} WAT`}
            />
          )}
          {w.notes && <Identifier label="Note" value={w.notes} />}
        </dl>
      </section>

      {/* Actions */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/dashboard/finance" className="flex-1">
          <Button variant="outline" className="h-11 w-full">
            Back to finance
          </Button>
        </Link>
        <Link href="/dashboard/finance/withdraw" className="flex-1">
          <Button className="h-11 w-full gap-2 bg-primary hover:bg-primary/90">
            <Banknote className="h-4 w-4" />
            New withdrawal
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Header({ right }: { right?: React.ReactNode } = {}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Link href="/dashboard/finance">
          <Button variant="outline" size="sm" className="h-8">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">Withdrawal</h1>
      </div>
      {right}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'emerald' | 'rose';
}) {
  const cls =
    tone === 'emerald'
      ? 'text-emerald-700'
      : tone === 'rose'
        ? 'text-rose-700'
        : 'text-foreground';
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-base font-semibold tabular-nums ${cls}`}>
        {value}
      </p>
    </div>
  );
}

function Identifier({
  label,
  value,
  mono,
  onCopy,
  copied,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-dashed border-border py-2 last:border-0">
      <dt className="shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd
        className={`flex min-w-0 items-center gap-1.5 break-all text-right text-sm ${
          mono ? 'font-mono' : ''
        }`}
      >
        <span className="truncate">{value}</span>
        {onCopy && (
          <button
            type="button"
            onClick={onCopy}
            title="Copy"
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {copied ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </dd>
    </div>
  );
}
