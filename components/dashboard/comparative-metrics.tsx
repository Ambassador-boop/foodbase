'use client';

import { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ShoppingCart,
  Wallet,
  Receipt,
  Users,
  Loader2,
} from 'lucide-react';

interface ComparativeData {
  metric: string;
  today: number;
  yesterday: number;
  changePercent: number;
  isIncrease: boolean;
}

const METRIC_ICONS: Record<string, React.ReactNode> = {
  Orders: <ShoppingCart className="h-4 w-4" />,
  Revenue: <Wallet className="h-4 w-4" />,
  'Avg Order Value': <Receipt className="h-4 w-4" />,
  Customers: <Users className="h-4 w-4" />,
};

export default function ComparativeMetrics() {
  const [comparisons, setComparisons] = useState<ComparativeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchComparisons = async () => {
      try {
        const businessId =
          typeof window !== 'undefined'
            ? localStorage.getItem('currentBusinessId')
            : null;
        const url = businessId
          ? `/api/business/dashboard/comparisons?businessId=${businessId}`
          : '/api/business/dashboard/comparisons';

        const response = await fetch(url, { cache: 'no-store' });
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) setComparisons(data.comparisons || []);
        }
      } catch (error) {
        console.error('Failed to fetch comparison data:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchComparisons();
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

  const isCurrencyMetric = (label: string) =>
    label === 'Revenue' || label === 'Avg Order Value';

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <header className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold">Today vs Yesterday</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            All values measured in West Africa Time
          </p>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : comparisons.length > 0 ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {comparisons.map((item) => {
            const flat = Math.abs(item.changePercent) < 0.5;
            const positive = item.isIncrease && !flat;
            const negative = !item.isIncrease && !flat;
            const TrendIcon = flat
              ? Minus
              : positive
                ? TrendingUp
                : TrendingDown;
            const trendClass = flat
              ? 'bg-muted text-muted-foreground'
              : positive
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : 'bg-rose-50 text-rose-700 border-rose-100';

            return (
              <div
                key={item.metric}
                className="rounded-xl border border-border bg-background p-3 sm:p-4 flex flex-col gap-2 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                    <span className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      {METRIC_ICONS[item.metric] || (
                        <ShoppingCart className="h-4 w-4" />
                      )}
                    </span>
                    {item.metric}
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-bold tabular-nums leading-tight">
                  {isCurrencyMetric(item.metric)
                    ? formatCurrency(Number(item.today))
                    : Number(item.today).toLocaleString()}
                </p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    Yest:{' '}
                    {isCurrencyMetric(item.metric)
                      ? formatCurrency(Number(item.yesterday))
                      : Number(item.yesterday).toLocaleString()}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border ${trendClass}`}
                  >
                    <TrendIcon className="w-3 h-3" />
                    {Math.abs(item.changePercent).toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-6 text-sm text-muted-foreground">
          No comparison data available
        </div>
      )}
    </section>
  );
}
