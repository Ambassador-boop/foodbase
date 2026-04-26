'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  Bell,
  BellOff,
  CheckCircle2,
  ChevronRight,
  Clock,
  Inbox,
  Loader2,
  RefreshCw,
  Search,
  ShoppingBag,
  TrendingUp,
  XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { format, parseISO, isToday, isYesterday } from 'date-fns';
import { toast } from 'sonner';

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  status: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
  business_id?: string;
  business_name?: string;
  menu_items?: Array<{ name: string; quantity: number }>;
}

type StatusFilter = 'all' | 'pending' | 'preparing' | 'completed' | 'cancelled';

const REFRESH_MS = 8000;

const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'preparing', label: 'Preparing' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const formatNGN = (amount: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(
    amount
  );

const niceDate = (iso: string) => {
  const d = parseISO(iso);
  if (isToday(d)) return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, MMM dd yyyy');
};

const dateKey = (iso: string) => format(parseISO(iso), 'yyyy-MM-dd');

function statusTone(status: string) {
  switch (status) {
    case 'completed':
      return {
        icon: <CheckCircle2 className="w-3.5 h-3.5" />,
        cls: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20',
      };
    case 'preparing':
      return {
        icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
        cls: 'bg-blue-50 text-blue-700 ring-1 ring-blue-600/20',
      };
    case 'cancelled':
      return {
        icon: <XCircle className="w-3.5 h-3.5" />,
        cls: 'bg-red-50 text-red-700 ring-1 ring-red-600/20',
      };
    case 'pending':
    default:
      return {
        icon: <Clock className="w-3.5 h-3.5" />,
        cls: 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20',
      };
  }
}

function paymentTone(status: string) {
  switch (status) {
    case 'paid':
      return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20';
    case 'pending':
      return 'bg-amber-50 text-amber-700 ring-1 ring-amber-600/20';
    case 'refunded':
      return 'bg-purple-50 text-purple-700 ring-1 ring-purple-600/20';
    default:
      return 'bg-red-50 text-red-700 ring-1 ring-red-600/20';
  }
}

/* ----------------------------- OneSignal hook ----------------------------- */

function useOneSignalSubscription(businessId?: string) {
  const [permission, setPermission] = useState<
    'default' | 'granted' | 'denied' | 'unsupported'
  >('default');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof Notification === 'undefined') {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as any);

    // Tag the OneSignal user with their business id so server-side
    // notifications targeting `business_id` reach them.
    if (!businessId) return;
    const w: any = window;
    w.OneSignalDeferred = w.OneSignalDeferred || [];
    w.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        await OneSignal.User.addTags({ business_id: businessId, role: 'owner' });
      } catch (err) {
        console.error('[v0] OneSignal tag error', err);
      }
    });
  }, [businessId]);

  const enable = useCallback(async () => {
    if (typeof window === 'undefined') return;
    setBusy(true);
    const w: any = window;
    w.OneSignalDeferred = w.OneSignalDeferred || [];
    w.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        await OneSignal.Notifications.requestPermission();
        if (businessId) {
          await OneSignal.User.addTags({
            business_id: businessId,
            role: 'owner',
          });
        }
        setPermission(Notification.permission as any);
        if (Notification.permission === 'granted') {
          toast.success('Notifications enabled');
        }
      } catch (err) {
        console.error('[v0] OneSignal enable error', err);
        toast.error('Could not enable notifications');
      } finally {
        setBusy(false);
      }
    });
  }, [businessId]);

  return { permission, enable, busy };
}

/* ---------------------------------- Page ---------------------------------- */

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [businessId, setBusinessId] = useState<string | undefined>();
  const lastSeenIdRef = useRef<string | null>(null);
  const isMobile = useIsMobile();

  const { permission, enable: enableNotifications, busy: enabling } =
    useOneSignalSubscription(businessId);

  const fetchOrders = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setRefreshing(true);
        const res = await fetch('/api/business/orders', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (!res.ok) throw new Error('Failed to fetch orders');
        const data: Order[] = await res.json();

        // Detect new orders for in-app toast
        if (lastSeenIdRef.current && data.length) {
          const newest = data[0];
          if (
            newest.id !== lastSeenIdRef.current &&
            data.findIndex((o) => o.id === lastSeenIdRef.current) > 0
          ) {
            const newCount = data.findIndex(
              (o) => o.id === lastSeenIdRef.current
            );
            toast.success(
              newCount > 1 ? `${newCount} new orders received` : 'New order received',
              {
                description: `${newest.customer_name} • ${formatNGN(
                  Number(newest.total_amount)
                )}`,
              }
            );
          }
        }
        if (data.length) {
          lastSeenIdRef.current = data[0].id;
          if (data[0].business_id) setBusinessId(data[0].business_id);
        }
        setOrders(data);
        setError('');
      } catch (err) {
        console.error('[v0] orders fetch failed', err);
        if (!silent) setError('Failed to load orders');
      } finally {
        if (!silent) {
          setLoading(false);
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    []
  );

  // Initial + polling (pauses when tab is hidden)
  useEffect(() => {
    fetchOrders(false);
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (interval) return;
      interval = setInterval(() => fetchOrders(true), REFRESH_MS);
    };
    const stop = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };
    start();
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        fetchOrders(true);
        start();
      } else {
        stop();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      stop();
    };
  }, [fetchOrders]);

  // Fallback: if no orders yet, fetch business id directly to enable tagging
  useEffect(() => {
    if (businessId) return;
    let active = true;
    fetch('/api/business', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.business?.id) setBusinessId(data.business.id);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [businessId]);

  /* ------------------------------- Filtering ------------------------------ */

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.customer_name?.toLowerCase().includes(q) ||
        o.customer_phone?.toLowerCase().includes(q) ||
        o.id?.toLowerCase().includes(q)
      );
    });
  }, [orders, statusFilter, searchQuery]);

  const grouped = useMemo(() => {
    const out: Record<string, Order[]> = {};
    filtered.forEach((o) => {
      const k = dateKey(o.created_at);
      (out[k] = out[k] || []).push(o);
    });
    return Object.keys(out)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((k) => ({ key: k, orders: out[k] }));
  }, [filtered]);

  /* -------------------------------- Stats -------------------------------- */

  const stats = useMemo(() => {
    const todayKey = format(new Date(), 'yyyy-MM-dd');
    const todayOrders = orders.filter(
      (o) => dateKey(o.created_at) === todayKey
    );
    const todayRevenue = todayOrders.reduce(
      (sum, o) => sum + Number(o.total_amount || 0),
      0
    );
    const counts = orders.reduce(
      (a, o) => {
        a[o.status] = (a[o.status] || 0) + 1;
        return a;
      },
      {} as Record<string, number>
    );
    return {
      total: orders.length,
      todayCount: todayOrders.length,
      todayRevenue,
      pending: counts.pending || 0,
      preparing: counts.preparing || 0,
      completed: counts.completed || 0,
    };
  }, [orders]);

  /* --------------------------------- UI ---------------------------------- */

  if (loading && orders.length === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Orders</h1>
          <p className="text-xs text-muted-foreground">
            Loading your live order feed…
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-xl bg-muted animate-pulse"
            />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-24 rounded-xl bg-muted animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Orders
            </h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Auto-refreshing every {REFRESH_MS / 1000}s • {orders.length} total
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => fetchOrders(false)}
            disabled={refreshing}
            className="gap-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
            />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </header>

      {/* OneSignal banner */}
      {permission !== 'granted' && permission !== 'unsupported' && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
              {permission === 'denied' ? (
                <BellOff className="w-4 h-4" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
            </div>
            <div>
              <p className="text-sm font-semibold">
                {permission === 'denied'
                  ? 'Notifications are blocked'
                  : 'Get instant order alerts'}
              </p>
              <p className="text-xs text-muted-foreground">
                {permission === 'denied'
                  ? 'Enable notifications in your browser settings to receive new-order alerts in real time.'
                  : 'Turn on notifications to be alerted when a new order arrives — even when this tab is in the background.'}
              </p>
            </div>
          </div>
          {permission !== 'denied' && (
            <Button
              onClick={enableNotifications}
              disabled={enabling}
              className="gap-2 sm:ml-auto"
            >
              {enabling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
              Enable alerts
            </Button>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Today"
          value={stats.todayCount.toString()}
          sub={formatNGN(stats.todayRevenue)}
          icon={<TrendingUp className="w-4 h-4" />}
          tone="emerald"
        />
        <StatCard
          label="Pending"
          value={stats.pending.toString()}
          icon={<Clock className="w-4 h-4" />}
          tone="amber"
        />
        <StatCard
          label="Preparing"
          value={stats.preparing.toString()}
          icon={<Loader2 className="w-4 h-4" />}
          tone="blue"
        />
        <StatCard
          label="Completed"
          value={stats.completed.toString()}
          icon={<CheckCircle2 className="w-4 h-4" />}
          tone="slate"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by name, phone, or order ID…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 sm:pb-0">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 h-10 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                statusFilter === f.key
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Inbox className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">
            {orders.length === 0
              ? 'No orders yet'
              : 'No orders match your filters'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {orders.length === 0
              ? 'Share your business to start receiving orders.'
              : 'Try adjusting the search or filter.'}
          </p>
          {orders.length === 0 && (
            <Link href="/dashboard/share">
              <Button className="mt-4 gap-2">
                <ShoppingBag className="w-4 h-4" />
                Share business
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ key, orders }) => {
            const dayRevenue = orders.reduce(
              (s, o) => s + Number(o.total_amount || 0),
              0
            );
            return (
              <section key={key}>
                <div className="flex items-center justify-between mb-3 sticky top-0 bg-background/90 backdrop-blur z-10 py-2 -mx-1 px-1">
                  <div>
                    <h2 className="text-sm font-semibold">
                      {niceDate(orders[0].created_at)}
                    </h2>
                    <p className="text-[11px] text-muted-foreground">
                      {orders.length} order{orders.length === 1 ? '' : 's'} •{' '}
                      {formatNGN(dayRevenue)}
                    </p>
                  </div>
                </div>

                {isMobile ? (
                  <div className="space-y-2">
                    {orders.map((o) => (
                      <OrderCard key={o.id} order={o} />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-card overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/40 border-b border-border">
                        <tr>
                          <Th>Customer</Th>
                          <Th>Items</Th>
                          <Th>Payment</Th>
                          <Th>Status</Th>
                          <Th className="text-right">Amount</Th>
                          <Th>Time</Th>
                          <Th className="w-12" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {orders.map((o) => (
                          <OrderRow key={o.id} order={o} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Sub-components ----------------------------- */

function StatCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone: 'emerald' | 'amber' | 'blue' | 'slate';
}) {
  const tones: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    blue: 'bg-blue-50 text-blue-700',
    slate: 'bg-slate-100 text-slate-700',
  };
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <div
          className={`w-7 h-7 rounded-lg flex items-center justify-center ${tones[tone]}`}
        >
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold mt-1.5 tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function Th({
  children,
  className = '',
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground ${className}`}
    >
      {children}
    </th>
  );
}

function OrderCard({ order }: { order: Order }) {
  const s = statusTone(order.status);
  return (
    <Link
      href={`/dashboard/orders/${order.id}`}
      className="block rounded-xl border border-border bg-card p-4 hover:shadow-md hover:border-primary/30 transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">
            {order.customer_name}
          </p>
          <p className="text-[11px] text-muted-foreground">
            #{order.id.slice(0, 8)} • {format(parseISO(order.created_at), 'p')}
          </p>
        </div>
        <p className="font-semibold text-sm tabular-nums whitespace-nowrap">
          {formatNGN(Number(order.total_amount))}
        </p>
      </div>

      {order.menu_items && order.menu_items.length > 0 && (
        <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
          {order.menu_items
            .map((i) => `${i.name}${i.quantity > 1 ? ` × ${i.quantity}` : ''}`)
            .join(', ')}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${s.cls}`}
          >
            {s.icon}
            {order.status}
          </span>
          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${paymentTone(order.payment_status)}`}
          >
            {order.payment_status}
          </span>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </div>
    </Link>
  );
}

function OrderRow({ order }: { order: Order }) {
  const s = statusTone(order.status);
  return (
    <tr className="hover:bg-muted/30 transition-colors">
      <td className="px-4 py-3">
        <p className="font-medium text-sm">{order.customer_name}</p>
        <p className="text-[11px] text-muted-foreground">
          #{order.id.slice(0, 8)}
        </p>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[260px]">
        {order.menu_items && order.menu_items.length > 0 ? (
          <span className="line-clamp-2">
            {order.menu_items
              .map(
                (i) => `${i.name}${i.quantity > 1 ? ` × ${i.quantity}` : ''}`
              )
              .join(', ')}
          </span>
        ) : (
          <span>—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className={`text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${paymentTone(order.payment_status)}`}
        >
          {order.payment_status}
        </span>
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full capitalize ${s.cls}`}
        >
          {s.icon}
          {order.status}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-semibold text-sm tabular-nums">
        {formatNGN(Number(order.total_amount))}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
        {format(parseISO(order.created_at), 'p')}
      </td>
      <td className="px-2 py-3">
        <Link
          href={`/dashboard/orders/${order.id}`}
          className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted text-muted-foreground"
          aria-label="View order"
        >
          <ChevronRight className="w-4 h-4" />
        </Link>
      </td>
    </tr>
  );
}
