'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { usePinAuthorization } from '@/hooks/use-pin-authorization';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Info,
  Loader2,
  ShieldCheck,
  Undo2,
  User,
  Wallet,
} from 'lucide-react';

interface OrderResp {
  order: { id: string; customer_name: string; customer_email: string; payment_status: string; payment_reference: string | null; total_amount: number };
  refunds: Array<{ id: string; amount: number; status: string }>;
}
interface Eligibility { netReceived: number; alreadyRefunded: number; refundable: number; serviceFee: number; bucket: 'pending' | 'available'; bucketBalance: number; }

const NGN = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(
    Number.isFinite(n) ? n : 0,
  );

const REASONS = [
  { value: 'customer_request', label: 'Customer request' },
  { value: 'wrong_order', label: 'Wrong order delivered' },
  { value: 'damaged_item', label: 'Item damaged or spoiled' },
  { value: 'duplicate_charge', label: 'Duplicate charge' },
  { value: 'out_of_stock', label: 'Item out of stock' },
  { value: 'payment_error', label: 'Payment error' },
  { value: 'other', label: 'Other' },
];

export default function RefundRequestPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const [data, setData] = useState<OrderResp | null>(null);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [type, setType] = useState<'full' | 'partial'>('full');
  const { authorize, dialogs } = usePinAuthorization();

  useEffect(() => {
    if (!orderId) return;
    (async () => {
      try {
        const res = await fetch(`/api/business/transactions/${orderId}`, {
          credentials: 'include',
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error || 'Failed to load order');
        }
        const j: OrderResp = await res.json();
        setData(j);
        const eligibilityRes = await fetch(`/api/refunds/eligibility?orderId=${encodeURIComponent(orderId)}`, { credentials: 'include' });
        const eligibilityJson = await eligibilityRes.json();
        if (eligibilityRes.ok) {
          setEligibility(eligibilityJson);
          setAmount(String(eligibilityJson.refundable));
        }
      } catch (err: any) {
        setError(err?.message || 'Failed to load order');
      } finally {
        setLoading(false);
      }
    })();
  }, [orderId]);

  const order = data?.order;
  const totalRefunded = useMemo(
    () =>
      (data?.refunds || [])
        .filter((r) =>
          ['pending', 'processing', 'processed'].includes(
            String(r.status).toLowerCase(),
          ),
        )
        .reduce((s, r) => s + Number(r.amount || 0), 0),
    [data],
  );
  const refundable = eligibility?.refundable ?? 0;

  const refundNum = parseFloat(amount) || 0;

  useEffect(() => {
    if (type === 'full' && order) setAmount(String(refundable));
  }, [type, order, refundable]);

  const validation = (() => {
    if (!order) return null;
    if (!refundNum) return 'Enter a refund amount';
    if (refundNum <= 0) return 'Amount must be greater than zero';
    if (refundNum > refundable) return `Maximum refundable is ${NGN(refundable)}`;
    if (eligibility && refundNum > eligibility.bucketBalance) return `Your ${eligibility.bucket} balance is not enough to cover this refund`;
    if (!reason) return 'Select a reason';
    return null;
  })();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validation) {
      setError(validation);
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const authorizationTicket = await authorize('refund', { orderId, amount: refundNum }, `Refund ${NGN(refundNum)}`);
      const res = await fetch('/api/refunds/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          orderId,
          amount: refundNum,
          reason,
          notes: notes || undefined,
          authorizationTicket,
        }),
      });
      const j = await res.json();
      if (!res.ok && !j.refundId) {
        throw new Error(j.error || 'Refund failed');
      }
      router.push(`/dashboard/finance/refunds/${j.refundId}`);
    } catch (err: any) {
      if (err?.message === 'cancelled') { setSubmitting(false); return; }
      setError(err?.message || 'Refund failed');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Header orderId={orderId} />
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

  if (!order) {
    return (
      <div className="space-y-4">
        <Header orderId={orderId} />
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-500" />
          <p className="mt-2 text-sm text-rose-700">
            {error || 'Order not found'}
          </p>
        </div>
      </div>
    );
  }

  if (refundable <= 0) {
    return (
      <div className="space-y-4">
        <Header orderId={orderId} />
        <div className="mx-auto max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <h2 className="mt-3 text-lg font-semibold">Already refunded</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This transaction has been fully refunded. No further refund is
            possible.
          </p>
          <Link
            href={`/dashboard/finance/transaction/${orderId}`}
            className="mt-4 inline-flex w-full items-center justify-center rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted/40"
          >
            Back to transaction
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-10">
      <Header orderId={orderId} />
      {dialogs}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 via-rose-50 to-amber-50 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
            <Undo2 className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Refund customer
            </p>
            <p className="mt-1 text-lg font-bold">{order.customer_name}</p>
            <p className="text-xs text-muted-foreground">
              Original payment: {NGN(order.total_amount)}
              {totalRefunded > 0 && (
                <>
                  {' · '}Already refunded: {NGN(totalRefunded)}
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5">
        {/* Refund type */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Refund type</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <TypeOption
              active={type === 'full'}
              onClick={() => setType('full')}
              title="Full refund"
              hint={NGN(refundable)}
            />
            <TypeOption
              active={type === 'partial'}
              onClick={() => setType('partial')}
              title="Partial refund"
              hint="Custom amount"
            />
          </div>
        </section>

        {/* Amount */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Refund amount</h2>
          <div className="mt-3 relative">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl font-semibold text-muted-foreground">
              ₦
            </span>
            <input
              type="number"
              step="0.01"
              min="0"
              max={refundable}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={type === 'full'}
              className="block w-full rounded-xl border border-border bg-background px-10 py-4 text-2xl font-bold tabular-nums focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:cursor-not-allowed disabled:bg-muted/40"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Max refundable: {NGN(refundable)}
            {eligibility && <> · {eligibility.bucket} balance: {NGN(eligibility.bucketBalance)}</>}
          </p>
          {eligibility && <p className="mt-1 text-xs text-amber-700">The {NGN(eligibility.serviceFee)} service fee is not refundable.</p>}
        </section>

        {/* Reason */}
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Reason</h2>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                className={`rounded-xl border px-3 py-2.5 text-left text-sm transition-colors ${
                  reason === r.value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-card hover:bg-muted/40'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          <div className="mt-4">
            <label
              htmlFor="notes"
              className="mb-1.5 block text-xs font-medium"
            >
              Additional notes (optional)
            </label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Add any context for this refund. The customer will see this note."
              className="block w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </section>

        {/* Trust note */}
        <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
          <p>
            Refunds are processed as online payments. Customers usually receive funds
            within a few business days, but it can take up to 10 business days.
          </p>
        </div>

        {validation && !error && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            {validation}
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/dashboard/finance/transaction/${orderId}`}
            className="sm:w-32"
          >
            <Button variant="outline" className="h-12 w-full text-sm font-medium">
              Cancel
            </Button>
          </Link>
          <button
            type="submit"
            disabled={submitting || !!validation}
            className="flex h-12 flex-1 items-center justify-center gap-2 rounded-lg bg-rose-600 px-6 text-base font-semibold text-white shadow-sm transition-all hover:bg-rose-700 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Processing refund…
              </>
            ) : (
              <>
                <Undo2 className="h-5 w-5" />
                Confirm refund · {NGN(refundNum)}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

function Header({ orderId }: { orderId: string }) {
  return (
    <div className="flex items-center gap-2">
      <Link href={`/dashboard/finance/transaction/${orderId}`}>
        <Button variant="outline" size="sm" className="h-8">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
      </Link>
      <h1 className="text-2xl font-bold tracking-tight">Request refund</h1>
    </div>
  );
}

function TypeOption({
  active,
  onClick,
  title,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-start gap-1 rounded-xl border px-4 py-3 text-left transition-colors ${
        active
          ? 'border-primary bg-primary/5'
          : 'border-border hover:bg-muted/40'
      }`}
    >
      <span className="flex items-center gap-2 text-sm font-medium">
        {active && <CheckCircle2 className="h-4 w-4 text-primary" />}
        {title}
      </span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </button>
  );
}
