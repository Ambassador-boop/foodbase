'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ShoppingCart,
  Activity,
  Eye,
  EyeOff,
  Wallet,
  Banknote,
  Receipt,
  CheckCircle2,
  CalendarDays,
  Loader2,
  RefreshCcw,
  ArrowRight,
  Utensils,
  Package,
  Share2,
  PiggyBank,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import TopSellingItems from '@/components/dashboard/top-selling-items';
import PeakHours from '@/components/dashboard/peak-hours';
import CustomerMetrics from '@/components/dashboard/customer-metrics';
import RecentOrders from '@/components/dashboard/recent-orders';
import ComparativeMetrics from '@/components/dashboard/comparative-metrics';
import OrderStatusMix from '@/components/dashboard/order-status-mix';
import WeekdayBreakdown from '@/components/dashboard/weekday-breakdown';

interface DashboardMetrics {
  todayOrders: number;
  todayRevenue: number;
  last30DaysOrders: number;
  availableBalance: number;
  pendingBalance: number;
  totalRevenue?: number;
  completedOrders?: number;
}

interface AnalyticsData {
  date: string;
  revenue: number;
  orders?: number;
}

type TimeRange = 'today' | 'week' | 'month' | 'last30';

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [chartData, setChartData] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [hideValues, setHideValues] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('today');
  const isMobile = useIsMobile();

  const fetchMetrics = useCallback(async (silent = false) => {
    try {
      if (!silent) setRefreshing(true);
      // Always use the server-side cookie resolution (no businessId param)
      // This ensures users always get their own active business, not stale localStorage data
      const url = '/api/business/dashboard';

      const response = await fetch(url, { cache: 'no-store' });
      if (!response.ok) throw new Error('Failed to fetch metrics');

      const data = await response.json();
      setMetrics(data.metrics);
      setChartData(data.chartData || []);
      setError('');
    } catch (err) {
      console.error('[v0] Dashboard fetch error:', err);
      setError('Could not load metrics. Pull to refresh.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics(true);
    const interval = setInterval(() => fetchMetrics(true), 15000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(amount);

  const formatYAxis = (value: number) => {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(0)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
    return value.toString();
  };

  // ----- Derived insights from chart data -----
  const insights = useMemo(() => {
    if (!chartData.length) {
      return {
        sumRevenue: 0,
        sumOrders: 0,
        bestDay: null as null | { date: string; revenue: number },
        avgPerDay: 0,
        firstHalfAvg: 0,
        secondHalfAvg: 0,
        weekTrend: 0,
      };
    }
    const sumRevenue = chartData.reduce((s, r) => s + (r.revenue || 0), 0);
    const sumOrders = chartData.reduce((s, r) => s + (r.orders || 0), 0);
    const bestDay = chartData.reduce(
      (b, r) => (r.revenue > (b?.revenue ?? -Infinity) ? r : b),
      chartData[0],
    );
    const avgPerDay = sumRevenue / chartData.length;
    const half = Math.ceil(chartData.length / 2);
    const first = chartData.slice(0, half);
    const second = chartData.slice(half);
    const firstHalfAvg =
      first.reduce((s, r) => s + r.revenue, 0) / Math.max(1, first.length);
    const secondHalfAvg =
      second.reduce((s, r) => s + r.revenue, 0) / Math.max(1, second.length);
    const weekTrend =
      firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;
    return {
      sumRevenue,
      sumOrders,
      bestDay,
      avgPerDay,
      firstHalfAvg,
      secondHalfAvg,
      weekTrend,
    };
  }, [chartData]);

  const mask = (v: string) => (hideValues ? '••••' : v);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="w-7 h-7 animate-spin mx-auto text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      {/* Page header */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Sales & balances overview
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchMetrics(false)}
            disabled={refreshing}
            className="h-9 gap-2"
          >
            {refreshing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCcw className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHideValues((v) => !v)}
            aria-label={hideValues ? 'Show values' : 'Hide values'}
            className="h-9 gap-2"
          >
            {hideValues ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">
              {hideValues ? 'Show' : 'Hide'}
            </span>
          </Button>
        </div>
      </header>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Hero strip — Today highlights + sparkline */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Today revenue hero */}
        <div className="lg:col-span-2 relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[11px] font-semibold uppercase tracking-wider">
                <Activity className="w-3 h-3" />
                Today
              </div>
              <p className="text-sm text-muted-foreground mt-3">Today&apos;s Revenue</p>
              <p className="text-3xl sm:text-4xl font-bold tracking-tight mt-1 tabular-nums">
                {mask(formatCurrency(metrics?.todayRevenue || 0))}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <ShoppingCart className="w-3.5 h-3.5" />
                  {mask(String(metrics?.todayOrders || 0))} orders today
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays className="w-3.5 h-3.5" />
                  {mask(String(metrics?.last30DaysOrders || 0))} in 30 days
                </span>
              </div>
            </div>
            {chartData.length > 1 && (
              <div className="hidden sm:block w-40 h-16 -mr-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="sparkRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#sparkRevenue)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {insights.bestDay && (
            <div className="mt-4 pt-4 border-t border-border/60 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
              <div>
                <span className="text-muted-foreground">7-day total:</span>{' '}
                <span className="font-semibold tabular-nums">
                  {mask(formatCurrency(insights.sumRevenue))}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Avg / day:</span>{' '}
                <span className="font-semibold tabular-nums">
                  {mask(formatCurrency(Math.round(insights.avgPerDay)))}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Best day:</span>{' '}
                <span className="font-semibold tabular-nums">
                  {insights.bestDay.date} ·{' '}
                  {mask(formatCurrency(Math.round(insights.bestDay.revenue)))}
                </span>
              </div>
              <div
                className={`inline-flex items-center gap-1 font-semibold ${
                  insights.weekTrend >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {insights.weekTrend >= 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5" />
                )}
                {Math.abs(insights.weekTrend).toFixed(0)}% week trend
              </div>
            </div>
          )}
        </div>

        {/* Wallet card */}
        <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 flex flex-col">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2 text-sm font-semibold">
              <Wallet className="w-4 h-4 text-primary" />
              Wallet
            </div>
            <Link
              href="/dashboard/finance"
              className="text-xs font-medium text-primary inline-flex items-center gap-1 hover:underline"
            >
              Open <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                <Banknote className="w-3.5 h-3.5" />
                Available
              </div>
              <p className="text-lg sm:text-xl font-bold mt-1 tabular-nums text-emerald-900">
                <span className={Number(metrics?.availableBalance ?? 0) < 0 ? 'text-destructive' : undefined}>{mask(formatCurrency(metrics?.availableBalance ?? 0))}</span>{Number(metrics?.availableBalance ?? 0) < 0 && <span className="ml-1 text-[10px] text-destructive">Deficit</span>}
              </p>
              <p className="text-[11px] text-emerald-700/80 mt-0.5">Ready to withdraw</p>
            </div>
            <div className="rounded-xl bg-amber-50 border border-amber-100 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                <PiggyBank className="w-3.5 h-3.5" />
                Pending
              </div>
              <p className="text-lg sm:text-xl font-bold mt-1 tabular-nums text-amber-900">
                <span className={Number(metrics?.pendingBalance ?? 0) < 0 ? 'text-destructive' : undefined}>{mask(formatCurrency(metrics?.pendingBalance ?? 0))}</span>{Number(metrics?.pendingBalance ?? 0) < 0 && <span className="ml-1 text-[10px] text-destructive">Deficit</span>}
              </p>
              <p className="text-[11px] text-amber-700/80 mt-0.5">Awaiting settlement</p>
            </div>
          </div>

          <Link href="/dashboard/finance" className="mt-4">
            <Button className="w-full h-10 gap-2">
              <Banknote className="w-4 h-4" />
              Withdraw funds
            </Button>
          </Link>
        </div>
      </section>

      {/* Secondary KPI tiles */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiTile
          icon={<ShoppingCart className="w-4 h-4" />}
          label="Today Orders"
          value={mask(String(metrics?.todayOrders || 0))}
          accent="blue"
          sub={`${mask(String(metrics?.last30DaysOrders || 0))} in 30 days`}
        />
        <KpiTile
          icon={<Receipt className="w-4 h-4" />}
          label="Today Revenue"
          value={mask(formatCurrency(metrics?.todayRevenue || 0))}
          accent="green"
          sub="Net of service fee"
        />
        <KpiTile
          icon={<TrendingUp className="w-4 h-4" />}
          label="Total Revenue"
          value={mask(formatCurrency(metrics?.totalRevenue || 0))}
          accent="violet"
          sub="Lifetime, paid orders"
        />
        <KpiTile
          icon={<CheckCircle2 className="w-4 h-4" />}
          label="Completed Orders"
          value={mask(String(metrics?.completedOrders || 0))}
          accent="teal"
          sub="Status = completed"
        />
      </section>

      {/* Revenue chart */}
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 overflow-hidden">
        <div className="flex items-start justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h2 className="text-base font-semibold">Revenue, last 7 days</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Daily totals from paid orders · West Africa Time
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[11px] font-semibold">
              <Activity className="w-3 h-3" />7-day total{' '}
              <span className="tabular-nums">
                {mask(formatCurrency(insights.sumRevenue))}
              </span>
            </div>
            {chartData.length > 1 && (
              <div
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-semibold border ${
                  insights.weekTrend >= 0
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                    : 'bg-rose-50 text-rose-700 border-rose-100'
                }`}
              >
                {insights.weekTrend >= 0 ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {Math.abs(insights.weekTrend).toFixed(0)}% trend
              </div>
            )}
          </div>
        </div>

        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={isMobile ? 220 : 280}>
            <AreaChart
              data={chartData}
              margin={{ top: 8, right: 8, left: 0, bottom: 8 }}
            >
              <defs>
                <linearGradient id="revAreaFull" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickLine={false}
                axisLine={false}
                width={45}
                tickFormatter={formatYAxis}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="hsl(var(--primary))"
                fill="url(#revAreaFull)"
                strokeWidth={2.4}
                name="Revenue"
                dot={{ r: 0 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-10 rounded-xl bg-muted/30 border border-dashed border-border">
            <Activity className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              No revenue activity in the last 7 days yet.
            </p>
          </div>
        )}

        {chartData.length > 1 && (
          <div className="mt-4 pt-4 border-t border-border/60 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <ChartStat
              label="Avg / day"
              value={mask(formatCurrency(Math.round(insights.avgPerDay)))}
            />
            <ChartStat
              label="Best day"
              value={
                insights.bestDay
                  ? mask(formatCurrency(Math.round(insights.bestDay.revenue)))
                  : '—'
              }
              sub={insights.bestDay?.date}
            />
            <ChartStat
              label="Orders (7d)"
              value={mask(insights.sumOrders.toLocaleString())}
            />
            <ChartStat
              label="Today"
              value={mask(formatCurrency(metrics?.todayRevenue || 0))}
            />
          </div>
        )}
      </section>

      {/* Comparative metrics — Today vs Yesterday */}
      <ComparativeMetrics />

      {/* Insights — time range selector controls Top sellers + Peak hours */}
      <section className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Insights</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Filter top sellers and peak hours
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-full bg-muted">
          {(['today', 'week', 'month', 'last30'] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                timeRange === r
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r === 'today'
                ? 'Today'
                : r === 'week'
                  ? 'Week'
                  : r === 'month'
                    ? 'Month'
                    : '30d'}
            </button>
          ))}
        </div>
      </section>

      {/* Two-up: Top sellers + Peak hours */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <TopSellingItems timeRange={timeRange} />
        <PeakHours timeRange={timeRange} />
      </section>

      {/* Customer insights */}
      <CustomerMetrics />

      {/* Two-up: Best weekdays + Order status mix */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <WeekdayBreakdown range="30d" />
        <OrderStatusMix range="30d" />
      </section>

      {/* Recent orders */}
      <RecentOrders />

      {/* Quick actions */}
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <h2 className="text-base font-semibold mb-3">Quick actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ActionCard
            href="/dashboard/menu"
            icon={<Utensils className="w-4 h-4" />}
            label="Menu"
            sub="Manage items"
          />
          <ActionCard
            href="/dashboard/orders"
            icon={<Package className="w-4 h-4" />}
            label="Orders"
            sub="Track & fulfill"
          />
          <ActionCard
            href="/dashboard/share"
            icon={<Share2 className="w-4 h-4" />}
            label="Share"
            sub="Get more orders"
          />
          <ActionCard
            href="/dashboard/finance"
            icon={<Banknote className="w-4 h-4" />}
            label="Finance"
            sub="Withdraw funds"
          />
        </div>
      </section>
    </div>
  );
}

function ChartStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-2.5">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-bold tabular-nums mt-1 leading-tight">{value}</p>
      {sub ? <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p> : null}
    </div>
  );
}

// -------------- Atoms --------------

function KpiTile({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: 'blue' | 'green' | 'violet' | 'teal' | 'amber';
}) {
  const styles: Record<string, { bg: string; ring: string; ic: string }> = {
    blue: {
      bg: 'bg-blue-50',
      ring: 'border-blue-100',
      ic: 'bg-blue-100 text-blue-700',
    },
    green: {
      bg: 'bg-emerald-50',
      ring: 'border-emerald-100',
      ic: 'bg-emerald-100 text-emerald-700',
    },
    violet: {
      bg: 'bg-indigo-50',
      ring: 'border-indigo-100',
      ic: 'bg-indigo-100 text-indigo-700',
    },
    teal: {
      bg: 'bg-teal-50',
      ring: 'border-teal-100',
      ic: 'bg-teal-100 text-teal-700',
    },
    amber: {
      bg: 'bg-amber-50',
      ring: 'border-amber-100',
      ic: 'bg-amber-100 text-amber-700',
    },
  };
  const s = styles[accent];

  return (
    <div className={`rounded-2xl border ${s.ring} ${s.bg} p-4 flex flex-col gap-2`}>
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.ic}`}
      >
        {icon}
      </div>
      <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
        {label}
      </p>
      <p className="text-xl sm:text-2xl font-bold tabular-nums leading-none">
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ActionCard({
  href,
  icon,
  label,
  sub,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-border bg-background hover:bg-muted/40 hover:border-primary/40 p-3 transition-colors flex items-start gap-3"
    >
      <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground ml-auto self-center group-hover:translate-x-0.5 transition-transform" />
    </Link>
  );
}
