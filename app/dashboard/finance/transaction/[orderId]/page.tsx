'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  CheckCircle2,
  Clock,
  Copy,
  CreditCard,
  Globe,
  Hash,
  Mail,
  MapPin,
  Phone,
  Receipt,
  RefreshCw,
  Sparkles,
  Undo2,
  User,
  XCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Authorization {
  authorization_code?: string;
  bin?: string;
  last4?: string;
  exp_month?: string;
  exp_year?: string;
  channel?: string;
  card_type?: string;
  bank?: string;
  country_code?: string;
  brand?: string;
  reusable?: boolean;
}

interface Customer {
  id?: number;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  customer_code?: string;
}

interface PaystackData {
  id?: number;
  reference?: string;
  status?: string;
  amount?: number; // in kobo
  fees?: number; // in kobo
  channel?: string;
  currency?: string;
  ip_address?: string;
  paid_at?: string;
  created_at?: string;
  gateway_response?: string;
  authorization?: Authorization;
  customer?: Customer;
  log?: {
    history?: Array<{ type: string; message: string; time: number }>;
    time_spent?: number;
  };
  error?: string;
}

interface OrderItem {
  id: string;
  menu_item_id: string;
  name: string | null;
  image: string | null;
  quantity: number;
  item_price: number;
}

interface RefundEntry {
  id: string;
  amount: number;
  status: string;
  reason?: string;
  created_at: string;
}

interface Resp {
  order: {
    id: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string | null;
    address: string | null;
    notes: string | null;
    status: string;
    payment_status: string;
    payment_reference: string | null;
    total_amount: number;
    service_fee_amount: number;
    created_at: string;
    paid_at: string | null;
    completed_at: string | null;
    business_name: string | null;
  };
  items: OrderItem[];
  refunds: RefundEntry[];
  paystack: PaystackData | null;
}

const NGN = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(
    Number.isFinite(n) ? n : 0,
  );

export default function TransactionDetailPage() {
  const params = useParams();
  const orderId = params.orderId as string;

  const [data, setData] = useState<Resp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/business/transactions/${orderId}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Failed to load transaction');
      }
      const j: Resp = await res.json();
      setData(j);
      setError('');
    } catch (err: any) {
      console.error('[v0] transaction detail error:', err);
      setError(err?.message || 'Failed to load transaction');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (orderId) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const ps = data?.paystack;
  const order = data?.order;
  const refunds = data?.refunds || [];
  const items = data?.items || [];

  const totalRefunded = useMemo(
    () =>
      refunds
        .filter((r) =>
          ['pending', 'processing', 'processed'].includes(
            String(r.status || '').toLowerCase(),
          ),
        )
        .reduce((s, r) => s + Number(r.amount || 0), 0),
    [refunds],
  );

  const refundable = order ? Math.max(0, order.total_amount - totalRefunded) : 0;
  const fullyRefunded = order ? totalRefunded >= order.total_amount : false;

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

  if (!order) {
    return (
      <div className="space-y-4">
        <Header />
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
          <p className="mt-2 text-sm text-rose-700">
            {error || 'Transaction not found'}
          </p>
        </div>
      </div>
    );
  }

  /* ---------- status hero --------------------------------------- */
  const statusKey = String(
    ps?.status || order.payment_status || 'pending',
  ).toLowerCase();

  const heroCfg = (() => {
    if (fullyRefunded) {
      return {
        label: 'Fully refunded',
        tone: 'rose' as const,
        icon: Undo2,
        msg: 'This transaction has been fully refunded to the customer.',
      };
    }
    switch (statusKey) {
      case 'success':
      case 'completed':
        return {
          label: 'Successful',
          tone: 'emerald' as const,
          icon: CheckCircle2,
          msg: 'Payment was processed successfully by Paystack.',
        };
      case 'reversed':
        return {
          label: 'Reversed',
          tone: 'rose' as const,
          icon: Undo2,
          msg: 'This transaction was reversed.',
        };
      case 'failed':
        return {
          label: 'Failed',
          tone: 'rose' as const,
          icon: XCircle,
          msg: ps?.gateway_response || 'This transaction failed to process.',
        };
      case 'abandoned':
        return {
          label: 'Abandoned',
          tone: 'rose' as const,
          icon: XCircle,
          msg: "The customer didn't complete this transaction.",
        };
      default:
        return {
          label: 'Pending',
          tone: 'amber' as const,
          icon: Clock,
          msg: 'Awaiting payment confirmation from Paystack.',
        };
    }
  })();

  const tone = {
    emerald: { ring: 'ring-emerald-200', soft: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-700' },
    rose: { ring: 'ring-rose-200', soft: 'bg-rose-50', icon: 'bg-rose-100 text-rose-700', text: 'text-rose-700' },
    amber: { ring: 'ring-amber-200', soft: 'bg-amber-50', icon: 'bg-amber-100 text-amber-700', text: 'text-amber-700' },
  }[heroCfg.tone];

  const Icon = heroCfg.icon;

  const psAmount = ps?.amount != null ? Number(ps.amount) / 100 : null;
  const psFees = ps?.fees != null ? Number(ps.fees) / 100 : null;
  const customerName =
    [ps?.customer?.first_name, ps?.customer?.last_name]
      .filter(Boolean)
      .join(' ') || order.customer_name;

  /* ---------- render -------------------------------------------- */
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
      <div
        className={`relative overflow-hidden rounded-2xl border ${tone.ring} ${tone.soft} p-5 shadow-sm`}
      >
        <div className="flex items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tone.icon}`}
          >
            <Icon className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Payment status
            </p>
            <p className={`mt-1 text-xl font-bold ${tone.text}`}>{heroCfg.label}</p>
            <p className="mt-1 text-xs text-muted-foreground md:text-sm">
              {heroCfg.msg}
            </p>
          </div>
        </div>
      </div>

      {/* Amount summary */}
      <section className="rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Total amount
        </p>
        <p className="mt-2 text-4xl font-bold tabular-nums">
          {NGN(order.total_amount)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-left sm:grid-cols-3">
          <Stat label="Subtotal" value={NGN(order.total_amount - order.service_fee_amount)} />
          <Stat label="Service fee" value={NGN(order.service_fee_amount)} />
          {totalRefunded > 0 ? (
            <Stat label="Refunded" value={NGN(totalRefunded)} tone="rose" />
          ) : psFees != null ? (
            <Stat label="Paystack fees" value={NGN(psFees)} />
          ) : (
            <Stat label="Net" value={NGN(order.total_amount)} tone="emerald" />
          )}
        </div>
      </section>

      {/* Customer card */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <User className="h-4 w-4 text-muted-foreground" />
          Customer
        </h2>
        <div className="mt-3 space-y-2 text-sm">
          {customerName && <Row icon={User} value={customerName} />}
          {order.customer_email && (
            <Row icon={Mail} value={order.customer_email} />
          )}
          {order.customer_phone && (
            <Row icon={Phone} value={order.customer_phone} />
          )}
          {order.address && <Row icon={MapPin} value={order.address} />}
          {ps?.ip_address && (
            <Row icon={Globe} label="IP address" value={ps.ip_address} mono />
          )}
          {ps?.customer?.customer_code && (
            <Row
              icon={Hash}
              label="Customer code"
              value={ps.customer.customer_code}
              mono
            />
          )}
        </div>
      </section>

      {/* Payment method (Paystack authorization) */}
      {ps?.authorization && (ps.authorization.last4 || ps.authorization.bank) && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            Payment method
          </h2>
          <div className="mt-3 rounded-xl border border-border bg-gradient-to-br from-slate-50 via-white to-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {ps.authorization.brand || ps.authorization.card_type || 'Card'}
                </p>
                <p className="mt-1 font-mono text-base font-semibold tracking-widest">
                  •••• •••• •••• {ps.authorization.last4 || '••••'}
                </p>
              </div>
              <div className="text-right">
                {ps.authorization.exp_month && ps.authorization.exp_year && (
                  <>
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      Expires
                    </p>
                    <p className="mt-1 font-mono text-sm">
                      {ps.authorization.exp_month}/
                      {String(ps.authorization.exp_year).slice(-2)}
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 border-t border-dashed border-border pt-3 text-xs text-muted-foreground">
              {ps.authorization.bank && (
                <span className="inline-flex items-center gap-1">
                  <BadgeCheck className="h-3 w-3" /> {ps.authorization.bank}
                </span>
              )}
              {ps.authorization.country_code && (
                <span>{ps.authorization.country_code}</span>
              )}
              {ps.authorization.channel && (
                <span className="capitalize">via {ps.authorization.channel}</span>
              )}
              {ps.authorization.reusable && (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                  Reusable
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Order items */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Receipt className="h-4 w-4 text-muted-foreground" />
          Items ({items.length})
        </h2>
        <ul className="mt-3 divide-y divide-border">
          {items.map((it) => (
            <li
              key={it.id}
              className="flex items-center gap-3 py-2.5"
            >
              {it.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={it.image}
                  alt={it.name || 'Item'}
                  className="h-12 w-12 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="h-12 w-12 shrink-0 rounded-lg bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {it.name || 'Item'}
                </p>
                <p className="text-xs text-muted-foreground">
                  Qty {it.quantity}
                </p>
              </div>
              <p className="text-sm font-semibold tabular-nums">
                {NGN(it.item_price * it.quantity)}
              </p>
            </li>
          ))}
          {items.length === 0 && (
            <li className="py-3 text-center text-xs text-muted-foreground">
              No items recorded
            </li>
          )}
        </ul>
      </section>

      {/* Paystack timeline */}
      {ps?.log?.history && ps.log.history.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            Transaction timeline
          </h2>
          <ol className="mt-4 space-y-3">
            {ps.log.history.map((h, i) => (
              <li key={i} className="flex gap-3">
                <div
                  className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                    h.type === 'success'
                      ? 'bg-emerald-500'
                      : h.type === 'error'
                        ? 'bg-rose-500'
                        : 'bg-amber-500'
                  }`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium capitalize">
                    {h.type}
                  </p>
                  <p className="text-xs text-muted-foreground">{h.message}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground/80">
                    {h.time}s after start
                  </p>
                </div>
              </li>
            ))}
          </ol>
          {ps.log.time_spent != null && (
            <p className="mt-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
              Total time spent: {ps.log.time_spent}s
            </p>
          )}
        </section>
      )}

      {/* Existing refunds */}
      {refunds.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Undo2 className="h-4 w-4 text-muted-foreground" />
            Refunds on this transaction
          </h2>
          <ul className="mt-3 divide-y divide-border">
            {refunds.map((r) => (
              <li key={r.id} className="py-2.5">
                <Link
                  href={`/dashboard/finance/refunds/${r.id}`}
                  className="flex items-center gap-3 -mx-2 rounded-lg px-2 py-1 hover:bg-muted/40"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-100 text-rose-700">
                    <Undo2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {NGN(r.amount)} ·{' '}
                      <span className="capitalize text-muted-foreground">
                        {String(r.status).replace(/-/g, ' ')}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(parseISO(r.created_at), 'MMM dd, yyyy · h:mm a')}
                      {r.reason ? ` · ${r.reason.replace(/_/g, ' ')}` : ''}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* References */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Hash className="h-4 w-4 text-muted-foreground" />
          References
        </h2>
        <dl className="mt-3 space-y-2 text-sm">
          <Identifier
            label="Order ID"
            value={order.id}
            mono
            onCopy={() => copy('Order ID', order.id)}
            copied={copied === 'Order ID'}
          />
          {order.payment_reference && (
            <Identifier
              label="Payment reference"
              value={order.payment_reference}
              mono
              onCopy={() => copy('Payment reference', order.payment_reference!)}
              copied={copied === 'Payment reference'}
            />
          )}
          {ps?.id && (
            <Identifier
              label="Paystack ID"
              value={String(ps.id)}
              mono
              onCopy={() => copy('Paystack ID', String(ps.id))}
              copied={copied === 'Paystack ID'}
            />
          )}
          {ps?.channel && (
            <Identifier label="Channel" value={ps.channel} mono />
          )}
          {ps?.gateway_response && (
            <Identifier label="Gateway response" value={ps.gateway_response} />
          )}
          <Identifier
            label="Created"
            value={format(parseISO(order.created_at), 'MMM dd, yyyy · h:mm:ss a')}
          />
          {order.paid_at && (
            <Identifier
              label="Paid at"
              value={format(
                parseISO(order.paid_at),
                'MMM dd, yyyy · h:mm:ss a',
              )}
            />
          )}
        </dl>
      </section>

      {/* Actions */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Link href={`/dashboard/orders/${order.id}`} className="flex-1">
          <Button variant="outline" className="h-11 w-full">
            View order details
          </Button>
        </Link>
        {!fullyRefunded && statusKey === 'success' && refundable > 0 && (
          <Link
            href={`/dashboard/finance/transaction/${order.id}/refund`}
            className="flex-1"
          >
            <Button className="h-11 w-full gap-2 bg-rose-600 text-white hover:bg-rose-700">
              <Undo2 className="h-4 w-4" />
              Request refund
            </Button>
          </Link>
        )}
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
        <h1 className="text-2xl font-bold tracking-tight">Transaction</h1>
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

function Row({
  icon: Icon,
  label,
  value,
  mono,
}: {
  icon: any;
  label?: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        {label && (
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
        )}
        <p className={`break-all ${mono ? 'font-mono' : ''} text-sm`}>
          {value}
        </p>
      </div>
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
