'use client';

import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CalendarRange, Loader2, Sparkles } from 'lucide-react';

interface WeekdayEntry {
  dow: number;
  label: string;
  orders: number;
  revenue: number;
}

interface ApiResponse {
  data: WeekdayEntry[];
  peak: WeekdayEntry | null;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);

export default function WeekdayBreakdown({
  range = '30d',
}: {
  range?: '7d' | '30d' | '90d';
}) {
  const [data, setData] = useState<WeekdayEntry[]>([]);
  const [peak, setPeak] = useState<WeekdayEntry | null>(null);
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
        const url = `/api/business/dashboard/weekday-breakdown?${params.toString()}`;
        const response = await fetch(url, { cache: 'no-store' });
        if (response.ok) {
          const j: ApiResponse = await response.json();
          if (!cancelled) {
            setData(j.data || []);
            setPeak(j.peak ?? null);
          }
        }
      } catch (err) {
        console.error('Failed to fetch weekday breakdown:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => {
      cancelled = true;
    };
  }, [range]);

  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 h-full flex flex-col">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <CalendarRange className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Best weekdays</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Revenue by day of week (WAT)
            </p>
          </div>
        </div>
        {peak && peak.revenue > 0 ? (
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
            <Sparkles className="w-3 h-3" />
            Best: {peak.label}
          </div>
        ) : null}
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-10 flex-1">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : totalRevenue > 0 ? (
        <>
          {peak && peak.revenue > 0 ? (
            <p className="sm:hidden text-xs text-muted-foreground mb-2">
              Best day:{' '}
              <span className="font-semibold text-primary">{peak.label}</span> ·{' '}
              {formatCurrency(peak.revenue)}
            </p>
          ) : null}
          <div className="flex-1 min-h-[180px]">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={data}
                margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                barCategoryGap="25%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                  tickFormatter={(v) => {
                    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(0)}M`;
                    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k`;
                    return v.toString();
                  }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: any, name: string) => [
                    name === 'revenue'
                      ? formatCurrency(Number(value))
                      : value,
                    name === 'revenue' ? 'Revenue' : 'Orders',
                  ]}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                />
                <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                  {data.map((entry) => (
                    <Cell
                      key={entry.dow}
                      fill={
                        peak && entry.dow === peak.dow
                          ? 'hsl(var(--primary))'
                          : 'hsl(var(--primary) / 0.35)'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      ) : (
        <div className="text-center py-10 flex-1 flex flex-col items-center justify-center gap-2">
          <CalendarRange className="w-6 h-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No revenue data for this window yet
          </p>
        </div>
      )}
    </section>
  );
}
