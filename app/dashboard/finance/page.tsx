'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowUpRight,
  Banknote,
  Clock,
  Filter,
  RefreshCw,
  Search,
  Sparkles,
  TimerReset,
  TrendingDown,
  TrendingUp,
  Undo2,
  Wallet,
} from 'lucide-react';
import { formatWat } from '@/lib/wat';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type FilterTab = 'all' | 'income' | 'withdrawals' | 'refunds';

interface Business {
  available_balance: number;
  pending_balance: number;
  total_orders?: number;
}

interface Txn {
  id: string;
  order_id: string | null;
  amount: number;
  transaction_type: string;
  status: string;
  payment_reference?: string;
  payment_method?: string;
  customer_name?: string;
  created_at: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  net_amount?: number | null;
  withdrawal_fee?: number;
  status: string;
  bank_code?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  reference?: string;
  created_at: string;
}

interface Refund {
  id: string;
  order_id: string;
  amount: number;
  status: string;
  customer_name?: string;
  created_at: string;
}

interface SettlementRecord {
  id: string;
  kind: string;
  amount: number;
  bucket: string | null;
  related_id: string | null;
  notes: string | null;
  created_at: string;
}

type Unified = {
  key: string;
  kind: 'income' | 'withdrawal' | 'refund' | 'settlement';
  status: string;
  amount: number;
  title: string;
  subtitle: string;
  meta?: string;
  href: string;
  created_at: string;
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const NGN = (n: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(n) ? n : 0);

const NGN_DEC = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(
    Number.isFinite(n) ? n : 0,
  );

export default function FinancePage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [transactions, setTransactions] = useState<Txn[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [settlements, setSettlements] = useState<SettlementRecord[]>([]);
  const [bankNameMap, setBankNameMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');

  /* ------------- data fetching ----------------------------------- */
  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [bRes, tRes, wRes, rRes, sRes] = await Promise.all([
        fetch('/api/business', { credentials: 'include' }),
        fetch('/api/business/transactions', { credentials: 'include' }),
        fetch('/api/business/withdrawals', { credentials: 'include' }),
        fetch('/api/business/refunds', { credentials: 'include' }),
        fetch('/api/business/finance-records', { credentials: 'include' }),
      ]);

      if (bRes.ok) {
        const d = await bRes.json();
        setBusiness(d.business);
      }
      if (tRes.ok) setTransactions((await tRes.json()) || []);
      if (wRes.ok) {
        const w = (await wRes.json()) || [];
        setWithdrawals(w);
        // Trigger reconciliation for pending withdrawals
        const hasPending = w.some((wd: Withdrawal) => 
          ['pending', 'queued', 'otp', 'received'].includes(String(wd.status).toLowerCase())
        );
        if (hasPending) {
          fetch('/api/business/reconcile-withdrawals', { credentials: 'include' }).catch(() => {});
        }
      }
      if (rRes.ok) setRefunds((await rRes.json()) || []);
      if (sRes.ok) setSettlements((await sRes.json()) || []);
      setError('');
    } catch (err) {
      console.error('[v0] finance fetch error:', err);
      setError('Failed to refresh data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const i = setInterval(() => fetchAll(true), 8000);
    return () => clearInterval(i);
  }, [fetchAll]);

  /* ------------- bank name lookup -------------------------------- */
  useEffect(() => {
    let cancelled = false;
    fetch('/api/paystack/banks')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.banks) return;
        const map: Record<string, string> = {};
        for (const b of d.banks) map[String(b.code)] = b.name;
        setBankNameMap(map);
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, []);

  /* ------------- derived ----------------------------------------- */
  const totals = useMemo(() => {
    const inflow = transactions
      .filter((t) => t.transaction_type === 'payment' && t.status === 'completed')
      .reduce((s, t) => s + Number(t.amount || 0), 0);
    const outflow = withdrawals
      .filter((w) => !['failed', 'rejected'].includes(String(w.status)))
      .reduce((s, w) => s + Number(w.amount || 0), 0);
    const refunded = refunds
      .filter((r) => !['failed', 'rejected'].includes(String(r.status)))
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    return { inflow, outflow, refunded };
  }, [transactions, withdrawals, refunds]);

  const unified: Unified[] = useMemo(() => {
    const list: Unified[] = [];

    for (const t of transactions) {
      list.push({
        key: `txn-${t.id}`,
        kind: 'income',
        status: t.status,
        amount: Number(t.amount || 0),
        title: 'Order payment',
        subtitle:
          t.customer_name?.trim() ||
          (t.order_id ? `Order ${String(t.order_id).slice(0, 8)}` : 'Customer'),
        meta: t.payment_method || 'Paystack',
        href: t.order_id ? `/dashboard/finance/transaction/${t.order_id}` : '#',
        created_at: t.created_at,
      });
    }

    for (const w of withdrawals) {
      const bankName = w.bank_code ? bankNameMap[w.bank_code] : undefined;
      list.push({
        key: `wd-${w.id}`,
        kind: 'withdrawal',
        status: w.status,
        amount: Number(w.amount || 0),
        title: 'Withdrawal',
        subtitle: bankName
          ? `${bankName}${w.bank_account_number
            ? ` •••• ${w.bank_account_number.slice(-4)}`
            : ''
          }`
          : w.bank_account_number
            ? `Bank •••• ${w.bank_account_number.slice(-4)}`
            : 'Bank transfer',
        meta: w.bank_account_holder || undefined,
        href: `/dashboard/finance/withdrawal/${w.id}`,
        created_at: w.created_at,
      });
    }

    for (const r of refunds) {
      list.push({
        key: `rf-${r.id}`,
        kind: 'refund',
        status: r.status,
        amount: Number(r.amount || 0),
        title: 'Refund',
        subtitle: r.customer_name || `Order ${String(r.order_id).slice(0, 8)}`,
        meta: 'Customer refund',
        href: `/dashboard/finance/refunds/${r.id}`,
        created_at: r.created_at,
      });
    }

    // Settlement events written by the 05:00 WAT cron — show them so
    // the business owner can see which pending balances graduated to
    // available, and when.
    for (const s of settlements) {
      list.push({
        key: `set-${s.id}`,
        kind: 'settlement',
        status: 'completed',
        amount: Number(s.amount || 0),
        title: 'Settlement',
        subtitle: 'Pending balance moved to available',
        meta: s.related_id
          ? `Order ${String(s.related_id).slice(0, 8)}`
          : 'Cron run',
        href: s.related_id
          ? `/dashboard/finance/transaction/${s.related_id}`
          : '/dashboard/finance',
        created_at: s.created_at,
      });
    }

    return list.sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  }, [transactions, withdrawals, refunds, settlements, bankNameMap]);

  const filtered = useMemo(() => {
    let list = unified;
    if (tab === 'income') list = list.filter((u) => u.kind === 'income');
    if (tab === 'withdrawals') list = list.filter((u) => u.kind === 'withdrawal');
    if (tab === 'refunds') list = list.filter((u) => u.kind === 'refund');
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (u) =>
          u.title.toLowerCase().includes(q) ||
          u.subtitle.toLowerCase().includes(q) ||
          (u.meta || '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [unified, tab, search]);

  /* ------------- render ------------------------------------------ */
  if (loading) {
    return (
      <div className="space-y-4 p-1">
        <div className="h-7 w-40 animate-pulse rounded bg-muted/60" />
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl bg-muted/60"
            />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-xl bg-muted/60"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-10">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight md:text-3xl">
            <Sparkles className="h-6 w-6 text-primary" />
            Finance
          </h1>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Hero balance card */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/95 via-primary to-primary/80 p-6 text-primary-foreground shadow-lg">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-8 h-44 w-44 rounded-full bg-white/5 blur-2xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-primary-foreground/80">
              <Wallet className="h-3.5 w-3.5" />
              Available balance
            </p>
            <p className="mt-2 text-3xl font-bold leading-none md:text-4xl">
              {NGN_DEC(business?.available_balance ?? 0)}
            </p>
            <p className="mt-2 text-xs text-primary-foreground/80">
              Pending settlement:{' '}
              <span className="font-medium text-primary-foreground">
                {NGN_DEC(business?.pending_balance ?? 0)}
              </span>
            </p>
          </div>
          <Link href="/dashboard/finance/withdraw" className="shrink-0">
            <Button
              size="sm"
              className="h-10 gap-1.5 bg-white text-primary hover:bg-white/90"
            >
              <Banknote className="h-4 w-4" />
              Withdraw
            </Button>
          </Link>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatTile
          icon={<TrendingUp className="h-4 w-4" />}
          tone="emerald"
          label="Total inflow"
          value={NGN(totals.inflow)}
          hint="From completed orders"
        />
        <StatTile
          icon={<TrendingDown className="h-4 w-4" />}
          tone="amber"
          label="Total withdrawn"
          value={NGN(totals.outflow)}
          hint="To your bank account"
        />
        <StatTile
          icon={<Undo2 className="h-4 w-4" />}
          tone="rose"
          label="Total refunded"
          value={NGN(totals.refunded)}
          hint="Issued to customers"
          className="col-span-2 md:col-span-1"
        />
      </div>

      {/* Filter + search */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1.5 overflow-x-auto rounded-xl border border-border bg-card p-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {(
            [
              ['all', 'All', unified.length],
              ['income', 'Income', unified.filter((u) => u.kind === 'income').length],
              [
                'withdrawals',
                'Withdrawals',
                unified.filter((u) => u.kind === 'withdrawal').length,
              ],
              ['refunds', 'Refunds', unified.filter((u) => u.kind === 'refund').length],
            ] as Array<[FilterTab, string, number]>
          ).map(([k, label, count]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${tab === k
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted/60'
                }`}
            >
              {label}
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${tab === k ? 'bg-white/20' : 'bg-muted/60 text-foreground'
                  }`}
              >
                {count}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search transactions"
            className="w-full rounded-lg border border-border bg-card py-2 pl-9 pr-3 text-sm placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>

      {/* Records list */}
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Filter className="h-4 w-4 text-muted-foreground" />
            Recent activity
          </h2>
          <span className="text-xs text-muted-foreground">
            {filtered.length} record{filtered.length === 1 ? '' : 's'}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted/50">
              <Wallet className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No activity yet</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              When customers pay, when you withdraw, and when refunds are
              issued — they&apos;ll all show up here.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map((u) => (
              <li key={u.key}>
                <Link
                  href={u.href}
                  className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30 active:bg-muted/40"
                >
                  <RecordIcon kind={u.kind} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <p className="truncate text-sm font-semibold">
                        {u.title}
                      </p>
                      <StatusPill status={u.status} kind={u.kind} />
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      {u.subtitle}
                      {u.meta ? ` · ${u.meta}` : ''}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground/80">
                      <Clock className="h-3 w-3" />
                      {formatWat(u.created_at, {
                        year: 'numeric',
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: true,
                      })}{' '}
                      WAT
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`text-sm font-bold tabular-nums ${u.kind === 'income'
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                        }`}
                    >
                      {u.kind === 'income' ? '+' : '−'}
                      {NGN(u.amount)}
                    </p>
                    <ArrowUpRight className="ml-auto mt-1 h-3.5 w-3.5 text-muted-foreground/60" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StatTile({
  icon,
  label,
  value,
  hint,
  tone,
  className = '',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone: 'emerald' | 'amber' | 'rose';
  className?: string;
}) {
  const tones = {
    emerald: {
      ring: 'border-emerald-200/60',
      bg: 'bg-emerald-50/60',
      icon: 'bg-emerald-100 text-emerald-700',
      value: 'text-emerald-700',
    },
    amber: {
      ring: 'border-amber-200/60',
      bg: 'bg-amber-50/60',
      icon: 'bg-amber-100 text-amber-700',
      value: 'text-amber-700',
    },
    rose: {
      ring: 'border-rose-200/60',
      bg: 'bg-rose-50/60',
      icon: 'bg-rose-100 text-rose-700',
      value: 'text-rose-700',
    },
  }[tone];

  return (
    <div
      className={`rounded-2xl border ${tones.ring} ${tones.bg} p-4 ${className}`}
    >
      <div className="flex items-center gap-2">
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-lg ${tones.icon}`}
        >
          {icon}
        </div>
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
      </div>
      <p className={`mt-3 text-xl font-bold tabular-nums ${tones.value}`}>
        {value}
      </p>
      <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>
    </div>
  );
}

function RecordIcon({ kind }: { kind: Unified['kind'] }) {
  if (kind === 'income') {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
        <ArrowDownCircle className="h-5 w-5" />
      </div>
    );
  }
  if (kind === 'withdrawal') {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
        <ArrowUpCircle className="h-5 w-5" />
      </div>
    );
  }
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-700">
      <Undo2 className="h-5 w-5" />
    </div>
  );
}

function StatusPill({
  status,
  kind,
}: {
  status: string;
  kind: Unified['kind'];
}) {
  const s = String(status || '').toLowerCase();
  const success = ['completed', 'success', 'processed'].includes(s);
  const failed = ['failed', 'rejected', 'abandoned', 'blocked', 'reversed'].includes(s);
  const cls = success
    ? 'bg-emerald-100 text-emerald-700'
    : failed
      ? 'bg-rose-100 text-rose-700'
      : 'bg-amber-100 text-amber-800';
  const label =
    s === 'success' && kind !== 'income' ? 'completed' : s.replace(/-/g, ' ');
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${cls}`}
    >
      {label || 'pending'}
    </span>
  );
}
