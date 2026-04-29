'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  ChefHat,
  ChevronDown,
  Clock,
  Copy,
  CreditCard,
  Hash,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  StickyNote,
  Truck,
  User,
  X,
} from 'lucide-react';

interface OrderItem {
  id: string;
  menu_item_id: string;
  menu_item_name: string;
  menu_item_description?: string;
  menu_item_image?: string;
  quantity: number;
  item_price: number;
  addons: Array<{
    id: string;
    name: string;
    price: number;
    image_url?: string;
  }>;
}

interface OrderData {
  order: {
    id: string;
    business_id: string;
    business_name: string;
    logo_url?: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    address: string;
    status: string;
    payment_status: string;
    notes?: string;
    created_at: string;
    completed_at?: string;
  };
  items: OrderItem[];
  calculations: {
    subtotal: number;
    serviceFee: number;
    total: number;
  };
}

const STATUSES: Array<{
  value: string;
  label: string;
  description: string;
}> = [
  { value: 'pending', label: 'Pending', description: 'Awaiting kitchen' },
  { value: 'preparing', label: 'Preparing', description: 'Being cooked' },
  { value: 'ready', label: 'Ready', description: 'Ready for pickup' },
  { value: 'completed', label: 'Completed', description: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled', description: 'Order cancelled' },
];

const STATUS_STYLES: Record<
  string,
  { dot: string; chip: string; bar: string }
> = {
  pending: {
    dot: 'bg-amber-500',
    chip: 'bg-amber-50 text-amber-700 border-amber-200',
    bar: 'from-amber-100 to-amber-50',
  },
  preparing: {
    dot: 'bg-blue-500',
    chip: 'bg-blue-50 text-blue-700 border-blue-200',
    bar: 'from-blue-100 to-blue-50',
  },
  ready: {
    dot: 'bg-violet-500',
    chip: 'bg-violet-50 text-violet-700 border-violet-200',
    bar: 'from-violet-100 to-violet-50',
  },
  completed: {
    dot: 'bg-emerald-500',
    chip: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    bar: 'from-emerald-100 to-emerald-50',
  },
  cancelled: {
    dot: 'bg-rose-500',
    chip: 'bg-rose-50 text-rose-700 border-rose-200',
    bar: 'from-rose-100 to-rose-50',
  },
};

const PAYMENT_STYLES: Record<string, string> = {
  paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  failed: 'bg-rose-50 text-rose-700 border-rose-200',
  refunded: 'bg-slate-100 text-slate-700 border-slate-200',
};

export default function OrderDetailsPage() {
  const params = useParams();
  const orderId = params?.orderId as string;
  const [orderData, setOrderData] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (orderId) fetchOrderData();
  }, [orderId]);

  const fetchOrderData = async () => {
    try {
      const response = await fetch(`/api/orders/${orderId}`);
      if (!response.ok) throw new Error('Failed to fetch order');

      const data = await response.json();
      setOrderData(data);
      setSelectedStatus(data.order.status);
      setError('');
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Failed to load order details');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!orderData || newStatus === orderData.order.status) return;

    setUpdating(true);
    setSelectedStatus(newStatus);
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update status');
      }

      setOrderData((prev) =>
        prev ? { ...prev, order: { ...prev.order, status: newStatus } } : null,
      );
    } catch (err) {
      console.error('Error updating status:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error';
      alert(`Failed to update order status: ${errorMessage}`);
      setSelectedStatus(orderData.order.status);
    } finally {
      setUpdating(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);

  const orderShortId = useMemo(
    () => (orderData ? String(orderData.order.id).slice(0, 8).toUpperCase() : ''),
    [orderData],
  );

  const orderTimes = useMemo(() => {
    if (!orderData) return null;
    const created = new Date(orderData.order.created_at);
    const ready = new Date(created.getTime() + 30 * 60_000);
    return {
      placedDate: created.toLocaleDateString(undefined, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }),
      placedTime: created.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      etaTime: ready.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  }, [orderData]);

  const handleCopy = async () => {
    if (!orderData) return;
    try {
      await navigator.clipboard.writeText(orderData.order.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/orders">
          <Button variant="outline" size="sm" className="h-8">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to orders
          </Button>
        </Link>
        <div className="flex h-72 items-center justify-center rounded-2xl border border-border bg-muted/20">
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading order details…
          </div>
        </div>
      </div>
    );
  }

  if (error || !orderData) {
    return (
      <div className="space-y-6">
        <Link href="/dashboard/orders">
          <Button variant="outline" size="sm" className="h-8">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to orders
          </Button>
        </Link>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-10 text-center">
          <AlertCircle className="h-8 w-8 text-rose-500" />
          <p className="text-sm font-medium text-rose-700">{error}</p>
        </div>
      </div>
    );
  }

  const statusKey = orderData.order.status || 'pending';
  const statusStyle = STATUS_STYLES[statusKey] || STATUS_STYLES.pending;
  const paymentKey = orderData.order.payment_status || 'pending';
  const paymentStyle =
    PAYMENT_STYLES[paymentKey] || 'bg-slate-100 text-slate-700 border-slate-200';
  const isPaid = paymentKey === 'paid' || paymentKey === 'completed';
  // Pending payments can also "View transaction" — that page hosts the
  // Recheck transaction status flow that pulls the latest from Paystack.
  const canViewTransaction = isPaid || paymentKey === 'pending';

  const statusIndex = STATUSES.findIndex((s) => s.value === statusKey);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/orders">
            <Button variant="outline" size="sm" className="h-8">
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Order
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              #{orderShortId}
            </h1>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/40"
          >
            {copied ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy order ID
              </>
            )}
          </button>
          {canViewTransaction && (
            <Link href={`/dashboard/finance/transaction/${orderData.order.id}`}>
              <Button className="h-9 gap-2 text-sm font-semibold">
                <Receipt className="h-4 w-4" />
                {isPaid ? 'View transaction' : 'Recheck transaction'}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Hero card */}
      <section
        className={`relative overflow-hidden rounded-2xl border border-border bg-card`}
      >
        <div
          className={`bg-gradient-to-br ${statusStyle.bar} px-5 py-4 sm:px-6 sm:py-5`}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/40 bg-white/70 text-foreground shadow-sm`}
              >
                <Package className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-foreground/70">
                  Order status
                </p>
                <h2 className="text-lg font-bold capitalize text-foreground sm:text-xl">
                  {orderData.order.status}
                </h2>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${paymentStyle}`}
              >
                <CreditCard className="h-3.5 w-3.5" />
                Payment {paymentKey}
              </span>
              {orderTimes && (
                <p className="text-xs text-foreground/60">
                  Placed {orderTimes.placedDate} · {orderTimes.placedTime}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Status timeline */}
        <div className="hidden border-t border-border px-5 py-4 sm:px-6 md:block">
          <div className="flex items-center gap-2">
            {STATUSES.filter((s) => s.value !== 'cancelled').map((s, idx, arr) => {
              const reached = statusIndex >= idx && statusKey !== 'cancelled';
              const current = s.value === statusKey;
              return (
                <div key={s.value} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors ${
                        reached
                          ? 'border-emerald-500 bg-emerald-500 text-white'
                          : current
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border bg-background text-muted-foreground'
                      }`}
                    >
                      {reached ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                    </div>
                    <p
                      className={`text-[11px] font-medium ${
                        reached || current
                          ? 'text-foreground'
                          : 'text-muted-foreground'
                      }`}
                    >
                      {s.label}
                    </p>
                  </div>
                  {idx < arr.length - 1 && (
                    <div
                      className={`mx-1 h-0.5 flex-1 ${
                        statusIndex > idx ? 'bg-emerald-500' : 'bg-border'
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Status update + meta */}
        <div className="grid gap-4 border-t border-border p-5 sm:grid-cols-3 sm:p-6">
          <MetaTile
            icon={<Calendar className="h-4 w-4 text-muted-foreground" />}
            label="Placed"
            value={
              orderTimes
                ? `${orderTimes.placedDate}\n${orderTimes.placedTime}`
                : '—'
            }
          />
          <MetaTile
            icon={<Clock className="h-4 w-4 text-muted-foreground" />}
            label="Estimated ready"
            value={orderTimes?.etaTime || '—'}
          />
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Update status
            </p>
            <div className="relative mt-1.5">
              <select
                value={selectedStatus}
                onChange={(e) => handleStatusUpdate(e.target.value)}
                disabled={updating}
                className="h-10 w-full appearance-none rounded-lg border border-border bg-background pl-3 pr-9 text-sm font-medium capitalize text-foreground transition-colors hover:bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label} — {status.description}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              {updating && (
                <Loader2 className="pointer-events-none absolute right-9 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" />
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Two-column layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Items + totals */}
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-2xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5 sm:px-6">
              <div className="flex items-center gap-2">
                <ChefHat className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">
                  Items ({orderData.items.length})
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">
                {orderData.items.reduce((acc, i) => acc + i.quantity, 0)} units
              </p>
            </div>

            <ul className="divide-y divide-border">
              {orderData.items.map((item, idx) => {
                // item.item_price is the BASE per-unit price.
                // Add-ons sit in `addons` and are summed on top per-unit.
                const perUnitPrice = Number(item.item_price) || 0;
                const addonsTotalPerUnit =
                  item.addons?.reduce(
                    (sum, addon) => sum + Number(addon.price || 0),
                    0,
                  ) || 0;
                const lineTotal =
                  (perUnitPrice + addonsTotalPerUnit) * item.quantity;
                const uniqueAddonIds = Array.from(
                  new Set(item.addons.map((a) => a.id)),
                );

                return (
                  <li key={idx} className="p-5 sm:p-6">
                    <div className="flex gap-4">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted sm:h-20 sm:w-20">
                        {item.menu_item_image ? (
                          <Image
                            src={item.menu_item_image}
                            alt={item.menu_item_name}
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <ShoppingBag className="h-6 w-6" />
                          </div>
                        )}
                        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground shadow">
                          {item.quantity}
                        </span>
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-foreground sm:text-base">
                              {item.menu_item_name}
                            </h4>
                            {item.menu_item_description && (
                              <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground sm:text-sm">
                                {item.menu_item_description}
                              </p>
                            )}
                          </div>
                          <p className="whitespace-nowrap text-sm font-bold text-foreground sm:text-base">
                            {formatCurrency(lineTotal)}
                          </p>
                        </div>

                        <p className="mt-1 text-xs text-muted-foreground">
                          {formatCurrency(perUnitPrice + addonsTotalPerUnit)} ×{' '}
                          {item.quantity}
                        </p>

                        {uniqueAddonIds.length > 0 && (
                          <ul className="mt-3 space-y-1.5 rounded-lg border border-dashed border-border bg-muted/20 p-3">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Add-ons
                            </p>
                            {uniqueAddonIds.map((addonId) => {
                              const addon = item.addons.find(
                                (a) => a.id === addonId,
                              );
                              if (!addon) return null;
                              const count = item.addons.filter(
                                (a) => a.id === addonId,
                              ).length;
                              return (
                                <li
                                  key={addonId}
                                  className="flex items-center justify-between gap-3 text-xs"
                                >
                                  <span className="truncate text-foreground">
                                    {addon.name}
                                    {count > 1 && (
                                      <span className="ml-1 text-muted-foreground">
                                        × {count}
                                      </span>
                                    )}
                                  </span>
                                  <span className="whitespace-nowrap font-medium text-muted-foreground">
                                    +
                                    {formatCurrency(
                                      addon.price * count * item.quantity,
                                    )}
                                  </span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Totals */}
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <h3 className="mb-3 text-sm font-semibold text-foreground">
              Pricing breakdown
            </h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Subtotal</dt>
                <dd className="font-medium tabular-nums">
                  {formatCurrency(orderData.calculations.subtotal)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Service Fee</dt>
                <dd className="font-medium tabular-nums">
                  + {formatCurrency(orderData.calculations.serviceFee)}
                </dd>
              </div>
              <div className="my-2 h-px bg-border" />
              <div className="flex items-center justify-between">
                <dt className="text-base font-semibold text-foreground">
                  Total paid
                </dt>
                <dd className="text-lg font-extrabold tabular-nums text-primary">
                  {formatCurrency(orderData.calculations.total)}
                </dd>
              </div>
            </dl>

            {canViewTransaction && (
              <Link
                href={`/dashboard/finance/transaction/${orderData.order.id}`}
                className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
              >
                <Receipt className="h-4 w-4" />
                {isPaid
                  ? 'View transaction details'
                  : 'Recheck transaction status'}
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </section>
        </div>

        {/* Customer side panel */}
        <aside className="space-y-6">
          <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Customer
              </h3>
            </div>
            <dl className="space-y-3 text-sm">
              <InfoRow
                icon={<User className="h-3.5 w-3.5" />}
                label="Name"
                value={orderData.order.customer_name || '—'}
              />
              <InfoRow
                icon={<Phone className="h-3.5 w-3.5" />}
                label="Phone"
                value={orderData.order.customer_phone || '—'}
                href={
                  orderData.order.customer_phone
                    ? `tel:${orderData.order.customer_phone}`
                    : undefined
                }
              />
              <InfoRow
                icon={<Mail className="h-3.5 w-3.5" />}
                label="Email"
                value={orderData.order.customer_email || '—'}
                href={
                  orderData.order.customer_email
                    ? `mailto:${orderData.order.customer_email}`
                    : undefined
                }
              />
              <InfoRow
                icon={
                  orderData.order.address?.toLowerCase().includes('pickup') ||
                  orderData.order.address?.toLowerCase().includes('restaurant') ? (
                    <ShoppingBag className="h-3.5 w-3.5" />
                  ) : (
                    <Truck className="h-3.5 w-3.5" />
                  )
                }
                label="Delivery"
                value={orderData.order.address || '—'}
                multiline
              />
            </dl>
          </section>

          {orderData.order.notes && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50/60 p-5">
              <div className="mb-2 flex items-center gap-2">
                <StickyNote className="h-4 w-4 text-amber-700" />
                <h3 className="text-sm font-semibold text-amber-900">
                  Special instructions
                </h3>
              </div>
              <p className="whitespace-pre-wrap text-sm text-amber-900/90">
                {orderData.order.notes}
              </p>
            </section>
          )}

          <section className="rounded-2xl border border-border bg-muted/30 p-5">
            <div className="mb-2 flex items-center gap-2">
              <Hash className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">
                Order reference
              </h3>
            </div>
            <p className="break-all font-mono text-xs text-muted-foreground">
              {orderData.order.id}
            </p>
            {isPaid && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs text-emerald-800">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                Payment verified by Paystack
              </div>
            )}
            {paymentKey === 'refunded' && (
              <div className="mt-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-100 p-2.5 text-xs text-slate-700">
                <X className="h-3.5 w-3.5 shrink-0" />
                Order refunded
              </div>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function MetaTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-4">
      <div className="flex items-center gap-1.5">
        {icon}
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      </div>
      <p className="mt-1.5 whitespace-pre-line text-sm font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
  href,
  multiline,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </dt>
        {href ? (
          <a
            href={href}
            className={`block text-sm font-medium text-primary hover:underline ${
              multiline ? '' : 'truncate'
            }`}
          >
            {value}
          </a>
        ) : (
          <dd
            className={`text-sm font-medium text-foreground ${
              multiline ? 'whitespace-pre-line' : 'truncate'
            }`}
          >
            {value}
          </dd>
        )}
      </div>
    </div>
  );
}
