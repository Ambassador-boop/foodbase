'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Copy,
  Hash,
  Mail,
  MapPin,
  Phone,
  Receipt,
  RefreshCw,
  Undo2,
  User,
  XCircle,
} from 'lucide-react';
import { formatWat } from '@/lib/wat';

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
    customer_email_masked: string | null;
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
  payment: { status: 'success' | 'pending' | 'failed' | 'abandoned' | 'reversed'; method_label: string; paid_at: string | null };
  settlement: { net_received: number | null; balance_bucket: string | null; settlement_status: string | null; available_at: string | null; settled_at: string | null };
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
  const [rechecking, setRechecking] = useState(false);
  const [recheckMessage, setRecheckMessage] = useState<{
    tone: 'ok' | 'warn' | 'err';
    text: string;
  } | null>(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [refundable, setRefundable] = useState(0);

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
      const eligibility = await fetch(`/api/refunds/eligibility?orderId=${encodeURIComponent(orderId)}`, { credentials: 'include' });
      if (eligibility.ok) setRefundable(Number((await eligibility.json()).refundable || 0));
      setError('');
    } catch (err: any) {
      console.error('[v0] transaction detail error:', err);
      setError(err?.message || 'Failed to load transaction');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRecheck = async () => {
    setRechecking(true);
    setRecheckMessage(null);
    try {
      const res = await fetch(`/api/transactions/recheck/${orderId}`, {
        method: 'POST',
        credentials: 'include',
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.ok) {
        setRecheckMessage({
          tone: 'ok',
          text: j.message || 'Payment confirmed.',
        });
        await fetchData();
      } else {
        setRecheckMessage({
          tone: j.paystackStatus === 'success' ? 'ok' : 'warn',
          text: j.message || j.error || 'Online payment has not confirmed this yet.',
        });
      }
    } catch (err: any) {
      setRecheckMessage({
        tone: 'err',
        text: err?.message || 'Failed to recheck transaction',
      });
    } finally {
      setRechecking(false);
    }
  };

  useEffect(() => {
    if (orderId) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

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

  const fullyRefunded = refundable <= 0;

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
    data?.payment.status || 'pending',
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
          msg: 'Payment was processed successfully.',
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
          msg: 'This transaction failed to process.',
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
          msg: 'Awaiting online payment confirmation.',
        };
    }
  })();

  const tone = {
    emerald: { ring: 'ring-emerald-200', soft: 'bg-emerald-50', icon: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-700' },
    rose: { ring: 'ring-rose-200', soft: 'bg-rose-50', icon: 'bg-rose-100 text-rose-700', text: 'text-rose-700' },
    amber: { ring: 'ring-amber-200', soft: 'bg-amber-50', icon: 'bg-amber-100 text-amber-700', text: 'text-amber-700' },
  }[heroCfg.tone];

  const Icon = heroCfg.icon;

  const customerName = order.customer_name;

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
        className={`relative overflow-hidden rounded-2xl border border-border bg-card p-5`}
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
            <p className={`mt-1 text-xl font-bold ${tone.text}`}>
              {heroCfg.label}
            </p>
            <p className="mt-1 text-xs text-muted-foreground md:text-sm">
              {heroCfg.msg}
            </p>

            {/* Recheck CTA — shown for any non-success state so the
                business owner can pull the latest from Paystack and
                self-heal pending/failed orders. */}
            {!['success', 'completed'].includes(statusKey) && (
              <div className="mt-3 flex flex-col gap-2">
                <Button
                  size="sm"
                  onClick={handleRecheck}
                  disabled={rechecking}
                  className="h-8 w-fit gap-1.5"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${
                      rechecking ? 'animate-spin' : ''
                    }`}
                  />
                  {rechecking
                    ? 'Rechecking…'
                    : 'Recheck transaction status'}
                </Button>
                {recheckMessage && (
                  <div
                    className={`flex items-start gap-2 rounded-lg border p-2.5 text-xs ${
                      recheckMessage.tone === 'ok'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                        : recheckMessage.tone === 'warn'
                          ? 'border-amber-200 bg-amber-50 text-amber-800'
                          : 'border-rose-200 bg-rose-50 text-rose-800'
                    }`}
                    role="status"
                  >
                    {recheckMessage.tone === 'ok' ? (
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>{recheckMessage.text}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Amount summary */}
      <section className="rounded-2xl border border-border bg-card p-5 text-center shadow-none">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Total amount
        </p>
        <p className="mt-2 text-4xl font-bold tabular-nums">
          {NGN(order.total_amount)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 text-left sm:grid-cols-3">
          <Stat label="Order total" value={NGN(order.total_amount)} />
          <Stat label="Service fee" value={NGN(order.service_fee_amount)} />
          {totalRefunded > 0 && <Stat label="Refunded" value={NGN(totalRefunded)} tone="rose" />}
          <Stat label="You receive" value={NGN(Number(data?.settlement.net_received || 0) - totalRefunded)} tone="emerald" />
        </div>
        {data?.settlement.settlement_status === 'pending' && data.settlement.available_at && <p className="mt-3 text-xs text-muted-foreground">Settles {formatWat(data.settlement.available_at, { dateStyle: 'medium', timeStyle: 'short' })} WAT</p>}
        {data?.settlement.settlement_status === 'settled' && data.settlement.settled_at && <p className="mt-3 text-xs text-muted-foreground">Settled {formatWat(data.settlement.settled_at, { dateStyle: 'medium', timeStyle: 'short' })} WAT</p>}
      </section>

      {/* Customer card */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-none">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <User className="h-4 w-4 text-muted-foreground" />
          Customer
        </h2>
        <div className="mt-3 space-y-2 text-sm">
          {customerName && <Row icon={User} value={customerName} />}
          {order.customer_email_masked && (
            <Row icon={Mail} value={order.customer_email_masked} />
          )}
          {order.customer_phone && (
            <Row icon={Phone} value={order.customer_phone} />
          )}
          {order.address && <Row icon={MapPin} value={order.address} />}
        </div>
      </section>

      {/* Order items */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-none">
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

      {/* Existing refunds */}
      {refunds.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-5 shadow-none">
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
                          {formatWat(r.created_at, {
                            year: 'numeric',
                            month: 'short',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true,
                          })}{' '}
                          WAT
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
      <section className="rounded-2xl border border-border bg-card p-5 shadow-none">
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
          <Identifier
            label="Created"
                value={`${formatWat(order.created_at, {
                  year: 'numeric',
                  month: 'short',
                  day: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: true,
                })} WAT`}
          />
          {order.paid_at && (
            <Identifier
              label="Paid at"
              value={`${formatWat(order.paid_at, {
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
        <Link href={`/dashboard/orders/${order.id}`} className="flex-1">
          <Button variant="outline" className="h-11 w-full">
            View order details
          </Button>
        </Link>
        {data.payment.status === 'success' && refundable > 0 && (
          <div className="flex-1">
            <Link href={`/dashboard/finance/transaction/${order.id}/refund`}><Button className="h-11 w-full gap-2 bg-rose-600 text-white hover:bg-rose-700"><Undo2 className="h-4 w-4" />Request refund</Button></Link>
            <p className="mt-2 text-center text-xs text-muted-foreground">The {NGN(order.service_fee_amount)} service fee is not refundable</p>
          </div>
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
