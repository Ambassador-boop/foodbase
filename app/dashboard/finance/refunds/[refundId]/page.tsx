'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  ArrowLeft,
  RefreshCw,
  Receipt,
  Hash,
  User,
  Mail,
  Phone,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  Loader2,
  Copy,
  ExternalLink,
  ShieldAlert,
  Info,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface RefundData {
  id: string;
  reference: string | null;
  paystack_refund_id: string | null;
  amount: number;
  currency: string;
  reason: string;
  notes: string | null;
  customer_note: string | null;
  status: string;
  paystack_status: string | null;
  failure_reason: string | null;
  expected_at: string | null;
  settled_at: string | null;
  refunded_by: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string | null;
  order: {
    id: string;
    customer_name: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    total_amount: number;
    payment_reference: string | null;
    created_at: string;
  };
  business: {
    id: string;
    name: string;
    slug: string | null;
    logo_url: string | null;
  };
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(Number(amount || 0));

const formatDateTime = (iso?: string | null) => {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-NG', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

type StatusKey =
  | 'pending'
  | 'processing'
  | 'processed'
  | 'failed'
  | 'needs-attention'
  | 'rejected'
  | 'refunded'
  | 'completed';

const STATUS_META: Record<
  StatusKey,
  { label: string; color: string; bg: string; ring: string; icon: any }
> = {
  pending: {
    label: 'Refund Pending',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    ring: 'ring-amber-200',
    icon: Clock,
  },
  processing: {
    label: 'Refund Processing',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    ring: 'ring-blue-200',
    icon: Loader2,
  },
  processed: {
    label: 'Refund Processed',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-200',
    icon: CheckCircle2,
  },
  refunded: {
    label: 'Refunded',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-200',
    icon: CheckCircle2,
  },
  completed: {
    label: 'Completed',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    ring: 'ring-emerald-200',
    icon: CheckCircle2,
  },
  failed: {
    label: 'Refund Failed',
    color: 'text-red-700',
    bg: 'bg-red-50',
    ring: 'ring-red-200',
    icon: XCircle,
  },
  rejected: {
    label: 'Rejected',
    color: 'text-red-700',
    bg: 'bg-red-50',
    ring: 'ring-red-200',
    icon: XCircle,
  },
  'needs-attention': {
    label: 'Needs Attention',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    ring: 'ring-orange-200',
    icon: ShieldAlert,
  },
};

const normalizeStatus = (s: string | null | undefined): StatusKey => {
  const v = (s || '').toLowerCase().replace(/_/g, '-');
  if (v in STATUS_META) return v as StatusKey;
  if (v === 'refund-processed') return 'processed';
  if (v === 'refund-failed') return 'failed';
  if (v === 'refund-pending') return 'pending';
  if (v === 'refund-processing') return 'processing';
  return 'pending';
};

export default function RefundDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const refundId = params?.refundId as string;

  const [refund, setRefund] = useState<RefundData | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRefund = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`/api/refunds/${refundId}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load refund');
      setRefund(data.refund || null);
    } catch (e: any) {
      console.error('[v0] refund detail error', e);
      if (!silent) toast.error(e.message || 'Could not load refund');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (refundId) fetchRefund();
  }, [refundId]);

  const liveStatus = normalizeStatus(refund?.status);

  // Auto-refresh while pending/processing
  useEffect(() => {
    if (!refund) return;
    if (liveStatus === 'pending' || liveStatus === 'processing') {
      const t = setInterval(() => fetchRefund(true), 15000);
      return () => clearInterval(t);
    }
  }, [refund?.id, liveStatus]);

  const handleRetry = async () => {
    if (!refund) return;
    setRetrying(true);
    try {
      const res = await fetch(`/api/refunds/${refundId}/retry`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Retry failed');
      toast.success('Refund retry submitted to Paystack');
      fetchRefund(true);
    } catch (e: any) {
      toast.error(e.message || 'Could not retry refund');
    } finally {
      setRetrying(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRefund(true);
    setRefreshing(false);
    toast.success('Refund status updated');
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  };

  // Timeline
  const timeline = useMemo(() => {
    if (!refund) return [];
    const items: {
      ts: string | null;
      title: string;
      description: string;
      state: 'done' | 'active' | 'pending' | 'fail';
    }[] = [];

    items.push({
      ts: refund.created_at,
      title: 'Refund requested',
      description: `Submitted by business for ${formatCurrency(refund.amount)}`,
      state: 'done',
    });

    if (refund.paystack_refund_id) {
      items.push({
        ts: refund.created_at,
        title: 'Sent to Paystack',
        description: `Refund ID: ${refund.paystack_refund_id}`,
        state: 'done',
      });
    }

    if (liveStatus === 'processing') {
      items.push({
        ts: refund.updated_at,
        title: 'Processing',
        description: refund.expected_at
          ? `Expected to settle by ${formatDateTime(refund.expected_at)}`
          : 'Paystack is processing the refund',
        state: 'active',
      });
    } else if (liveStatus === 'pending') {
      items.push({
        ts: refund.updated_at,
        title: 'Pending review',
        description: 'Awaiting Paystack to begin processing',
        state: 'active',
      });
    }

    if (liveStatus === 'needs-attention') {
      items.push({
        ts: refund.updated_at,
        title: 'Needs attention',
        description:
          refund.failure_reason ||
          'Paystack flagged this refund. Please contact support@paystack.com.',
        state: 'fail',
      });
    }

    if (liveStatus === 'failed' || liveStatus === 'rejected') {
      items.push({
        ts: refund.updated_at,
        title: 'Refund failed',
        description: refund.failure_reason || 'Refund could not be processed',
        state: 'fail',
      });
    }

    if (
      liveStatus === 'processed' ||
      liveStatus === 'refunded' ||
      liveStatus === 'completed'
    ) {
      items.push({
        ts: refund.settled_at || refund.updated_at,
        title: 'Refund processed',
        description: `${formatCurrency(refund.amount)} refunded to the customer`,
        state: 'done',
      });
    }

    return items;
  }, [refund, liveStatus]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!refund) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
          <AlertCircle className="w-7 h-7 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-bold">Refund not found</h1>
        <p className="text-muted-foreground mt-2 max-w-sm">
          This refund record doesn&apos;t exist or you don&apos;t have access to it.
        </p>
        <Button onClick={() => router.push('/dashboard/finance')} className="mt-6">
          Back to finance
        </Button>
      </div>
    );
  }

  const meta = STATUS_META[liveStatus];
  const StatusIcon = meta.icon;
  const isLive = liveStatus === 'pending' || liveStatus === 'processing';
  const canRetry = liveStatus === 'failed' || liveStatus === 'rejected';

  return (
    <div className="min-h-screen bg-gradient-to-b from-muted/30 to-background">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => router.back()}
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Refund
              </p>
              <h1 className="text-sm sm:text-base font-bold truncate">
                #{String(refund.id).slice(0, 8).toUpperCase()}
              </h1>
            </div>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-9 gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Hero status card */}
        <section className={`relative overflow-hidden rounded-2xl ring-1 ${meta.ring} ${meta.bg}`}>
          <div className={`relative px-5 sm:px-8 py-7 ${meta.color}`}>
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-white/70 backdrop-blur px-3 py-1 text-[11px] font-semibold uppercase tracking-wider">
                  <StatusIcon
                    className={`w-3.5 h-3.5 ${liveStatus === 'processing' ? 'animate-spin' : ''}`}
                  />
                  {meta.label}
                </div>
                <p className="text-[11px] uppercase tracking-wider font-semibold mt-4 opacity-80">
                  Refund Amount
                </p>
                <p className="text-3xl sm:text-4xl font-extrabold tabular-nums mt-1">
                  {formatCurrency(refund.amount)}
                </p>
                <p className="text-sm opacity-80 mt-1">
                  Requested {formatDateTime(refund.created_at)}
                </p>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                {canRetry && (
                  <Button
                    onClick={handleRetry}
                    disabled={retrying}
                    size="sm"
                    className="bg-white text-foreground hover:bg-white/90"
                  >
                    {retrying ? (
                      <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4 mr-1.5" />
                    )}
                    Retry refund
                  </Button>
                )}
                <Link
                  href={`/dashboard/finance/transaction/${refund.order.id}`}
                  className="text-xs font-semibold underline-offset-4 hover:underline text-right"
                >
                  View transaction
                </Link>
              </div>
            </div>

            {isLive && (
              <div className="mt-5 rounded-xl bg-white/70 backdrop-blur px-4 py-3 flex items-start gap-2.5 text-foreground/80">
                <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-600" />
                <p className="text-xs leading-relaxed">
                  {liveStatus === 'processing'
                    ? `This refund is being processed by Paystack. ${
                        refund.expected_at
                          ? `Expected to settle by ${formatDateTime(refund.expected_at)}.`
                          : 'It typically takes 1–10 business days.'
                      }`
                    : 'Paystack will pick up this refund shortly. We auto-refresh the status every 15 seconds.'}
                </p>
              </div>
            )}

            {(liveStatus === 'failed' || liveStatus === 'needs-attention') &&
              refund.failure_reason && (
                <div className="mt-5 rounded-xl bg-white/80 px-4 py-3 flex items-start gap-2.5 text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <p className="text-xs leading-relaxed font-medium">
                    {refund.failure_reason}
                  </p>
                </div>
              )}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: timeline + reason */}
          <div className="lg:col-span-2 space-y-6">
            {/* Timeline */}
            <Card>
              <SectionHeader
                icon={<Clock className="w-4 h-4" />}
                title="Timeline"
                subtitle="Track the refund from request to settlement"
              />
              <div className="px-5 sm:px-6 pb-6">
                <ol className="relative">
                  {timeline.map((item, idx) => {
                    const isLast = idx === timeline.length - 1;
                    return (
                      <li key={idx} className="relative pl-8 pb-6 last:pb-0">
                        {!isLast && (
                          <span
                            className={`absolute left-[11px] top-5 bottom-0 w-px ${
                              item.state === 'done'
                                ? 'bg-emerald-300'
                                : item.state === 'fail'
                                  ? 'bg-red-300'
                                  : 'bg-muted-foreground/30'
                            }`}
                          />
                        )}
                        <span
                          className={`absolute left-0 top-1 w-[22px] h-[22px] rounded-full border-2 border-background flex items-center justify-center ${
                            item.state === 'done'
                              ? 'bg-emerald-500 text-white'
                              : item.state === 'active'
                                ? 'bg-blue-500 text-white'
                                : item.state === 'fail'
                                  ? 'bg-red-500 text-white'
                                  : 'bg-muted text-muted-foreground'
                          }`}
                        >
                          {item.state === 'done' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : item.state === 'active' ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : item.state === 'fail' ? (
                            <XCircle className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                        </span>
                        <div>
                          <p className="text-sm font-semibold">{item.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.description}
                          </p>
                          {item.ts && (
                            <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                              {formatDateTime(item.ts)}
                            </p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </Card>

            {/* Reason and notes */}
            <Card>
              <SectionHeader
                icon={<FileText className="w-4 h-4" />}
                title="Reason"
                subtitle="Why this refund was issued"
              />
              <div className="px-5 sm:px-6 pb-6 space-y-4">
                <KV
                  label="Reason"
                  value={refund.reason
                    .replace(/_/g, ' ')
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
                />
                {refund.notes && (
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Internal notes
                    </p>
                    <p className="text-sm mt-1 leading-relaxed">{refund.notes}</p>
                  </div>
                )}
                {refund.customer_note && (
                  <div className="rounded-lg bg-muted/50 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Note shared with customer
                    </p>
                    <p className="text-sm mt-1 leading-relaxed">
                      {refund.customer_note}
                    </p>
                  </div>
                )}
              </div>
            </Card>
          </div>

          {/* Right column: refund refs / order / customer */}
          <div className="space-y-6">
            <Card>
              <SectionHeader
                icon={<Hash className="w-4 h-4" />}
                title="Refund details"
              />
              <div className="px-5 sm:px-6 pb-6 space-y-3 text-sm">
                <Detail
                  label="Internal ID"
                  value={refund.id}
                  copyable
                  onCopy={() => copyToClipboard(refund.id, 'Refund ID')}
                  mono
                />
                {refund.paystack_refund_id && (
                  <Detail
                    label="Paystack Refund ID"
                    value={refund.paystack_refund_id}
                    copyable
                    onCopy={() =>
                      copyToClipboard(refund.paystack_refund_id!, 'Paystack ID')
                    }
                    mono
                  />
                )}
                {refund.reference && (
                  <Detail
                    label="Reference"
                    value={refund.reference}
                    copyable
                    onCopy={() => copyToClipboard(refund.reference!, 'Reference')}
                    mono
                  />
                )}
                <Detail
                  label="Amount"
                  value={formatCurrency(refund.amount)}
                  bold
                />
                {refund.expected_at && (
                  <Detail
                    label="Expected at"
                    value={formatDateTime(refund.expected_at)}
                  />
                )}
                {refund.settled_at && (
                  <Detail
                    label="Settled at"
                    value={formatDateTime(refund.settled_at)}
                  />
                )}
              </div>
            </Card>

            <Card>
              <SectionHeader
                icon={<Receipt className="w-4 h-4" />}
                title="Original transaction"
              />
              <div className="px-5 sm:px-6 pb-6 space-y-3 text-sm">
                <Detail
                  label="Order ID"
                  value={`#${refund.order.id.slice(0, 8).toUpperCase()}`}
                />
                <Detail
                  label="Order amount"
                  value={formatCurrency(refund.order.total_amount)}
                />
                {refund.order.payment_reference && (
                  <Detail
                    label="Payment ref"
                    value={refund.order.payment_reference}
                    mono
                    copyable
                    onCopy={() =>
                      copyToClipboard(refund.order.payment_reference!, 'Reference')
                    }
                  />
                )}
                <Detail
                  label="Order date"
                  value={formatDateTime(refund.order.created_at)}
                />
                <Link
                  href={`/dashboard/finance/transaction/${refund.order.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline pt-1"
                >
                  View transaction
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </Card>

            <Card>
              <SectionHeader
                icon={<User className="w-4 h-4" />}
                title="Customer"
              />
              <div className="px-5 sm:px-6 pb-6 space-y-3 text-sm">
                <ContactRow
                  icon={<User className="w-3.5 h-3.5" />}
                  value={refund.order.customer_name || '—'}
                />
                {refund.order.customer_email && (
                  <ContactRow
                    icon={<Mail className="w-3.5 h-3.5" />}
                    value={refund.order.customer_email}
                  />
                )}
                {refund.order.customer_phone && (
                  <ContactRow
                    icon={<Phone className="w-3.5 h-3.5" />}
                    value={refund.order.customer_phone}
                  />
                )}
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── Atoms ────────────────────────────────────────────────────────────────
function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="bg-card rounded-2xl border shadow-sm overflow-hidden">
      {children}
    </section>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="px-5 sm:px-6 pt-5 pb-3">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
          {icon}
        </span>
        <div>
          <h2 className="text-sm font-bold leading-tight">{title}</h2>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
    </header>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
        {label}
      </p>
      <p className="text-sm mt-1 font-medium leading-relaxed">{value}</p>
    </div>
  );
}

function Detail({
  label,
  value,
  copyable,
  onCopy,
  mono,
  bold,
}: {
  label: string;
  value: string;
  copyable?: boolean;
  onCopy?: () => void;
  mono?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs uppercase tracking-wider font-semibold text-muted-foreground shrink-0">
        {label}
      </span>
      <div className="text-right min-w-0 flex items-center gap-1.5 flex-wrap justify-end">
        <span
          className={`${mono ? 'font-mono text-xs' : 'text-sm'} ${
            bold ? 'font-bold' : 'font-medium'
          } break-all`}
        >
          {value}
        </span>
        {copyable && onCopy && (
          <button
            onClick={onCopy}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={`Copy ${label}`}
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

function ContactRow({ icon, value }: { icon: React.ReactNode; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="w-6 h-6 rounded-md bg-muted flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
        {icon}
      </span>
      <p className="text-sm font-medium break-words">{value}</p>
    </div>
  );
}
