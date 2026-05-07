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
import { Clock, Loader2, Sparkles } from 'lucide-react';

interface HourlyData {
  hour: string;
  orders: number;
  revenue: number;
}

interface ApiResponse {
  data: HourlyData[];
  peak: HourlyData | null;
}

export default function PeakHours({
  timeRange = 'today',
}: {
  timeRange?: string;
}) {
  const [data, setData] = useState<HourlyData[]>([]);
  const [peak, setPeak] = useState<HourlyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchHourlyData = async () => {
      setLoading(true);
      try {
        // Always use the server-side cookie resolution (no businessId param)
        const response = await fetch(`/api/business/dashboard/hourly?timeRange=${timeRange}`, { cache: 'no-store' });
        if (response.ok) {
          const result: ApiResponse = await response.json();
          if (!cancelled) {
            setData(result.data || []);
            setPeak(result.peak ?? null);
          }
        }
      } catch (error) {
        console.error('Failed to fetch hourly data:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchHourlyData();
    return () => {
      cancelled = true;
    };
  }, [timeRange]);

  // Trim leading/trailing empty hours so the chart focuses on
  // operating hours instead of squashing 24 bars onto a phone screen.
  const display = (() => {
    if (data.length === 0) return [];
    let start = 0;
    let end = data.length - 1;
    while (start < data.length && data[start].orders === 0) start++;
    while (end > start && data[end].orders === 0) end--;
    if (start >= end) return data;
    return data.slice(Math.max(0, start - 1), Math.min(24, end + 2));
  })();

  const totalOrders = data.reduce((s, h) => s + h.orders, 0);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 h-full flex flex-col">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Peak hours</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              When orders come in (WAT)
            </p>
          </div>
        </div>
        {peak && peak.orders > 0 ? (
          <div className="hidden sm:inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-semibold">
            <Sparkles className="w-3 h-3" />
            Peak {peak.hour} · {peak.orders} order{peak.orders === 1 ? '' : 's'}
          </div>
        ) : null}
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-10 flex-1">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : totalOrders > 0 ? (
        <>
          {peak && peak.orders > 0 ? (
            <p className="sm:hidden text-xs text-muted-foreground mb-2">
              Busiest hour:{' '}
              <span className="font-semibold text-primary">{peak.hour}</span> ·{' '}
              {peak.orders} order{peak.orders === 1 ? '' : 's'}
            </p>
          ) : null}
          <div className="flex-1 min-h-[180px]">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={display}
                margin={{ top: 8, right: 8, left: 0, bottom: 4 }}
                barCategoryGap="20%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="hsl(var(--border))"
                  vertical={false}
                />
                <XAxis
                  dataKey="hour"
                  interval="preserveStartEnd"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(value: any) => [value, 'Orders']}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  cursor={{ fill: 'hsl(var(--muted) / 0.5)' }}
                />
                <Bar dataKey="orders" radius={[6, 6, 0, 0]}>
                  {display.map((entry) => (
                    <Cell
                      key={entry.hour}
                      fill={
                        peak && entry.hour === peak.hour
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
          <Clock className="w-6 h-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No hourly data for this window yet
          </p>
        </div>
      )}
    </section>
  );
}
