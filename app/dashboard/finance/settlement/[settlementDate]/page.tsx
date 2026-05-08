'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Hash,
  RefreshCw,
  TrendingUp,
  Undo2,
} from 'lucide-react';
import { formatWat } from '@/lib/wat';

interface SettlementItem {
  id: string;
  amount: number;
  description: string;
  related_id: string;
  order_id: string;
  reference: string;
  payment_method: string;
  currency: string;
  created_at: string;
  refund_info: {
    total_refunded: number;
    refund_count: number;
    refunds: Array<{
      id: string;
      amount: number;
      status: string;
      processed_at: string;
    }>;
  } | null;
  is_fully_refunded: boolean;
}

interface SettlementDetails {
  settlement_date: string;
  summary: {
    total_transactions: number;
    total_gross: number;
    total_refunded: number;
    total_settled: number;
    settlement_time: string;
  };
  settlements: SettlementItem[];
}

const NGN = (n: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

export default function SettlementDetailsPage() {
  const params = useParams();
  const settlementDate = params.settlementDate as string;

  const [data, setData] = useState<SettlementDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(
        `/api/business/settlements/${settlementDate}`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Failed to load settlement');
      }
      const j: SettlementDetails = await res.json();
      setData(j);
      setError('');
    } catch (err: any) {
      console.error('[v0] settlement detail error:', err);
      setError(err?.message || 'Failed to load settlement');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (settlementDate) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settlementDate]);

  const copy = async (label: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 1200);
    } catch {}
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Header />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl bg-muted/60"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <Header />
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
          <p className="mt-2 text-sm text-rose-700">
            {error || 'Settlement not found'}
          </p>
        </div>
      </div>
    );
  }

  const summary = data.summary;
  const settlements = data.settlements || [];

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

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Status hero */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Settlement Status
            </p>
            <p className="mt-1 text-xl font-bold text-emerald-700">
              Settled on {new Date(data.settlement_date).toLocaleDateString('en-NG', {
                year: 'numeric',
                month: 'long',
                day: '2-digit',
              })}
            </p>
            <p className="mt-1 text-xs text-muted-foreground md:text-sm">
              All pending transactions for this date have been moved to available balance.
            </p>
          </div>
        </div>
      </div>

      {/* Settlement summary */}
      <section className="rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Total Settled
        </p>
        <p className="mt-2 text-4xl font-bold tabular-nums">
          {NGN(summary.total_settled)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-left sm:grid-cols-3">
          <Stat
            label="Transactions"
            value={String(summary.total_transactions)}
          />
          <Stat label="Gross Amount" value={NGN(summary.total_gross)} />
          {summary.total_refunded > 0 ? (
            <Stat
              label="Refunded"
              value={NGN(summary.total_refunded)}
              tone="rose"
            />
          ) : (
            <Stat label="Net" value={NGN(summary.total_settled)} tone="emerald" />
          )}
        </div>
      </section>

      {/* Settlements list */}
      {settlements.length > 0 ? (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Settled Transactions ({settlements.length})
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {settlements.map((settlement) => (
              <li key={settlement.id} className="py-3">
                <Link
                  href={`/dashboard/finance/transaction/${settlement.order_id}`}
                  className="flex items-start gap-3 -mx-2 rounded-lg px-2 py-1 hover:bg-muted/40"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 mt-0.5">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">
                          Order {String(settlement.order_id).slice(0, 8)}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {settlement.payment_method || 'Paystack'} ·{' '}
                          {formatWat(settlement.created_at, {
                            year: 'numeric',
                            month: 'short',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })} WAT
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {NGN(settlement.amount)}
                        </p>
                        {settlement.refund_info && (
                          <p className="text-xs text-rose-600">
                            -{NGN(settlement.refund_info.total_refunded)} refunded
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Refund details if applicable */}
                    {settlement.refund_info && settlement.refund_info.refunds.length > 0 && (
                      <div className="mt-2 rounded-lg border border-rose-100 bg-rose-50 p-2.5">
                        <div className="flex items-start gap-2">
                          <Undo2 className="h-3.5 w-3.5 text-rose-600 mt-0.5 shrink-0" />
                          <div className="min-w-0 flex-1 text-xs">
                            <p className="font-medium text-rose-900">
                              {settlement.refund_info.refund_count} refund
                              {settlement.refund_info.refund_count !== 1 ? 's' : ''}
                            </p>
                            {settlement.refund_info.refunds.map((refund) => (
                              <p
                                key={refund.id}
                                className="text-rose-700 mt-1"
                              >
                                • {NGN(refund.amount)} -{' '}
                                <span className="capitalize">
                                  {refund.status.replace(/-/g, ' ')}
                                </span>
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-border bg-muted/20 p-8 text-center shadow-sm">
          <p className="text-sm text-muted-foreground">
            No transactions settled on this date
          </p>
        </section>
      )}

      {/* Summary details */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Hash className="h-4 w-4 text-muted-foreground" />
          Settlement Details
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Identifier
            label="Settlement Date"
            value={new Date(data.settlement_date).toLocaleDateString('en-NG', {
              year: 'numeric',
              month: 'long',
              day: '2-digit',
            })}
          />
          <Identifier
            label="Total Transactions"
            value={String(summary.total_transactions)}
          />
          <Identifier
            label="Gross Amount"
            value={NGN(summary.total_gross)}
          />
          <Identifier
            label="Total Refunded"
            value={NGN(summary.total_refunded)}
          />
          <Identifier
            label="Total Settled"
            value={NGN(summary.total_settled)}
          />
          {summary.settlement_time && (
            <Identifier
              label="Settlement Time"
              value={`${formatWat(summary.settlement_time, {
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
        </dl>
      </section>

      {/* Actions */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href="/dashboard/finance" className="flex-1">
          <Button variant="outline" className="h-11 w-full">
            Back to Finance
          </Button>
        </Link>
      </div>
    </div>
  );
}

/* ---------- subcomponents ----------------------------------------- */

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
        <h1 className="text-2xl font-bold tracking-tight">Settlement</h1>
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
