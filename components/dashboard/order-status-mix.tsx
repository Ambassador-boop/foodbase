'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  XCircle,
  AlertOctagon,
  Hourglass,
  Loader2,
  PieChart as PieIcon,
} from 'lucide-react';

interface BreakdownEntry {
  count: number;
  pct: number;
}

interface ApiResponse {
  total: number;
  breakdown: {
    completed: BreakdownEntry;
    confirmed: BreakdownEntry;
    pending: BreakdownEntry;
    failed: BreakdownEntry;
    cancelled: BreakdownEntry;
  };
}

const SEGMENTS = [
  {
    key: 'completed' as const,
    label: 'Completed',
    color: 'bg-emerald-500',
    fg: 'text-emerald-700',
    swatch: 'bg-emerald-500',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  {
    key: 'confirmed' as const,
    label: 'Confirmed',
    color: 'bg-blue-500',
    fg: 'text-blue-700',
    swatch: 'bg-blue-500',
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  {
    key: 'pending' as const,
    label: 'Pending',
    color: 'bg-amber-500',
    fg: 'text-amber-700',
    swatch: 'bg-amber-500',
    icon: <Hourglass className="h-3.5 w-3.5" />,
  },
  {
    key: 'failed' as const,
    label: 'Failed',
    color: 'bg-rose-500',
    fg: 'text-rose-700',
    swatch: 'bg-rose-500',
    icon: <AlertOctagon className="h-3.5 w-3.5" />,
  },
  {
    key: 'cancelled' as const,
    label: 'Cancelled',
    color: 'bg-slate-400',
    fg: 'text-slate-700',
    swatch: 'bg-slate-400',
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
];

export default function OrderStatusMix({
  range = '30d',
}: {
  range?: '7d' | '30d' | '90d';
}) {
  const [resp, setResp] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      setLoading(true);
      try {
        const businessId =
          typeof window !== 'undefined'
            ? localStorage.getItem('currentBusinessId')
            : null;
        const params = new URLSearchParams({ range });
        if (businessId) params.append('businessId', businessId);
        const url = `/api/business/dashboard/order-status?${params.toString()}`;
        const response = await fetch(url, { cache: 'no-store' });
        if (response.ok) {
          const data: ApiResponse = await response.json();
          if (!cancelled) setResp(data);
        }
      } catch (err) {
        console.error('Failed to fetch order status mix:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [range]);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 h-full">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <PieIcon className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Order status mix</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Distribution over the window
            </p>
          </div>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : resp && resp.total > 0 ? (
        <div className="flex flex-col gap-4">
          {/* Stacked bar */}
          <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden flex">
            {SEGMENTS.map((seg) => {
              const e = resp.breakdown[seg.key];
              if (!e || e.pct <= 0) return null;
              return (
                <div
                  key={seg.key}
                  className={seg.color}
                  style={{ width: `${e.pct}%` }}
                  title={`${seg.label}: ${e.count} (${e.pct.toFixed(0)}%)`}
                />
              );
            })}
          </div>

          {/* Legend grid */}
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {SEGMENTS.map((seg) => {
              const e = resp.breakdown[seg.key];
              if (!e) return null;
              return (
                <li
                  key={seg.key}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border bg-background"
                >
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <span
                      className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${seg.swatch}`}
                    />
                    <span className="text-sm truncate">{seg.label}</span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
                    {e.count.toLocaleString()}{' '}
                    <span className="text-[11px] font-normal text-muted-foreground">
                      ({e.pct.toFixed(0)}%)
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <div className="text-center py-8 flex flex-col items-center gap-2">
          <PieIcon className="w-6 h-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No orders in this window
          </p>
        </div>
      )}
    </section>
  );
}
