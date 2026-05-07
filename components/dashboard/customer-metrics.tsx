'use client';

import { useEffect, useState } from 'react';
import { Users, TrendingUp, RotateCcw, UserPlus, Loader2 } from 'lucide-react';

interface CustomerMetricsData {
  newCustomersToday: number;
  averageOrderValue: number;
  repeatCustomerRate: number;
  totalCustomers: number;
  returningCustomers: number;
}

export default function CustomerMetrics() {
  const [metrics, setMetrics] = useState<CustomerMetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchMetrics = async () => {
      try {
        // Always use the server-side cookie resolution (no businessId param)
        const response = await fetch('/api/business/dashboard/customer-metrics', { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) setMetrics(data.metrics);
        }
      } catch (error) {
        console.error('Failed to fetch customer metrics:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchMetrics();
    return () => {
      cancelled = true;
    };
  }, []);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      maximumFractionDigits: 0,
    }).format(amount);

  if (loading) {
    return (
      <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </section>
    );
  }

  if (!metrics) return null;

  // Cap progress visuals at 100%
  const repeatPct = Math.min(100, metrics.repeatCustomerRate || 0);

  const tiles = [
    {
      label: 'New today',
      value: metrics.newCustomersToday.toString(),
      sub: 'First-time customers (WAT day)',
      icon: <UserPlus className="h-4 w-4" />,
      tone: 'bg-blue-50 text-blue-700 border-blue-100',
    },
    {
      label: 'Avg Order Value',
      value: formatCurrency(metrics.averageOrderValue),
      sub: 'Lifetime average',
      icon: <TrendingUp className="h-4 w-4" />,
      tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    },
    {
      label: 'Total Customers',
      value: metrics.totalCustomers.toLocaleString(),
      sub: `${metrics.returningCustomers.toLocaleString()} returning`,
      icon: <Users className="h-4 w-4" />,
      tone: 'bg-amber-50 text-amber-700 border-amber-100',
    },
    {
      label: 'Repeat Rate',
      value: `${repeatPct.toFixed(1)}%`,
      sub: 'Customers ordering 2+ times',
      icon: <RotateCcw className="h-4 w-4" />,
      tone: 'bg-teal-50 text-teal-700 border-teal-100',
      progress: repeatPct,
    },
  ];

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold">Customer Insights</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Who&apos;s ordering and how often
          </p>
        </div>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="rounded-xl border border-border bg-background p-3 sm:p-4 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center border ${tile.tone}`}
              >
                {tile.icon}
              </div>
            </div>
            <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
              {tile.label}
            </p>
            <p className="text-xl sm:text-2xl font-bold tabular-nums leading-tight">
              {tile.value}
            </p>
            {typeof tile.progress === 'number' ? (
              <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${tile.progress}%` }}
                />
              </div>
            ) : null}
            <p className="text-[11px] text-muted-foreground">{tile.sub}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
