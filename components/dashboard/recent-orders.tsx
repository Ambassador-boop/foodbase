'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Clock,
  ChevronRight,
  Loader2,
  ShoppingBag,
  Receipt,
  AlertCircle,
  CheckCircle2,
  Hourglass,
} from 'lucide-react';
import { formatWat } from '@/lib/wat';

interface RecentOrder {
  id: string;
  customerName: string;
  totalAmount: number;
  createdAt: string;
  status: string;
  paymentStatus?: string;
  itemCount: number;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);

const formatRelative = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatWat(dateString, {
    month: 'short',
    day: '2-digit',
  });
};

const STATUS_TONE: Record<
  string,
  { tone: string; icon: React.ReactNode; label: string }
> = {
  pending: {
    tone: 'bg-amber-50 text-amber-700 border-amber-100',
    icon: <Hourglass className="h-3 w-3" />,
    label: 'Pending',
  },
  confirmed: {
    tone: 'bg-blue-50 text-blue-700 border-blue-100',
    icon: <CheckCircle2 className="h-3 w-3" />,
    label: 'Confirmed',
  },
  completed: {
    tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    icon: <CheckCircle2 className="h-3 w-3" />,
    label: 'Completed',
  },
  cancelled: {
    tone: 'bg-rose-50 text-rose-700 border-rose-100',
    icon: <AlertCircle className="h-3 w-3" />,
    label: 'Cancelled',
  },
};

export default function RecentOrders() {
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchOrders = async () => {
      try {
        // Always use the server-side cookie resolution (no businessId param)
        const params = new URLSearchParams({ limit: '8', sort: 'latest' });

        const response = await fetch(
          `/api/business/orders?${params.toString()}`,
          { cache: 'no-store' },
        );
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) setOrders(data.orders || []);
        }
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchOrders();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Receipt className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Recent orders</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Latest activity from your store
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/orders"
          className="text-xs font-medium text-primary inline-flex items-center gap-1 hover:underline"
        >
          View all <ChevronRight className="w-3 h-3" />
        </Link>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : orders.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {orders.map((order) => {
            const statusKey = String(order.status || 'pending').toLowerCase();
            const status =
              STATUS_TONE[statusKey] || STATUS_TONE.pending;

            return (
              <li key={order.id}>
                <Link
                  href={`/dashboard/orders/${order.id}`}
                  className="group flex items-center gap-3 p-3 rounded-xl border border-border bg-background hover:bg-muted/40 hover:border-primary/30 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold truncate">
                        {order.customerName || 'Guest'}
                      </p>
                      <p className="text-sm font-bold tabular-nums whitespace-nowrap">
                        {formatCurrency(order.totalAmount)}
                      </p>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${status.tone}`}
                        >
                          {status.icon}
                          {status.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {order.itemCount} item
                          {order.itemCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 flex-shrink-0">
                        <Clock className="w-3 h-3" />
                        {formatRelative(order.createdAt)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform flex-shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="text-center py-8 flex flex-col items-center gap-2">
          <ShoppingBag className="w-6 h-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No orders yet</p>
          <p className="text-xs text-muted-foreground">
            Share your store link to start receiving orders
          </p>
        </div>
      )}
    </section>
  );
}
