'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { TrendingUp, AlertCircle, DollarSign, ShoppingCart, Activity, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area, AreaChart } from 'recharts';
import { useIsMobile } from '@/hooks/use-mobile';

interface DashboardMetrics {
  todayOrders: number;
  todayRevenue: number;
  todayPendingRevenue: number;
  last30DaysOrders: number;
  availableBalance: number;
  pendingWithdrawals: number;
  totalRevenue?: number;
  completedOrders?: number;
}

interface AnalyticsData {
  date: string;
  revenue: number;
  orders?: number;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [chartData, setChartData] = useState<AnalyticsData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hideValues, setHideValues] = useState(false);
  const isMobile = useIsMobile();

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await fetch('/api/business/dashboard');

      if (!response.ok) throw new Error('Failed to fetch metrics');

      const data = await response.json();
      setMetrics(data.metrics);
      setChartData(data.chartData || []);
      setError('');
    } catch (err) {
      setError('Failed to load metrics');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  const formatYAxis = (value: number) => {
    if (value >= 1000000000) return `${(value / 1000000000).toFixed(0)}B`;
    if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
    return value.toString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground text-sm">Loading metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-bold mb-0.5">Dashboard</h1>
        <p className="text-xs text-muted-foreground">Restaurant performance overview</p>
      </div>

      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Compact Unified Metrics Card - Fully Responsive, No Scroll */}
      <div className="bg-white border border-border rounded-lg p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Key Metrics</h2>
          <button
            onClick={() => setHideValues(!hideValues)}
            className="p-1 hover:bg-muted rounded text-muted-foreground"
            aria-label="Toggle values visibility"
          >
            {hideValues ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Metrics Cards */}
        <div className="flex gap-2">
          {/* Today's Orders */}
          <div className="flex-1 flex flex-col items-center gap-1 bg-primary/5 p-2 rounded-lg border border-primary/10">
            <ShoppingCart className="w-5 h-5 text-primary mb-1" />
            <p className="text-[10px] text-muted-foreground font-medium uppercase text-center">Today Orders</p>
            <p className="text-sm font-bold text-foreground">{hideValues ? '••' : metrics?.todayOrders || 0}</p>
            <p className="text-[10px] text-muted-foreground text-center">
              {hideValues ? '••' : `${metrics?.last30DaysOrders || 0} last 30 days`}
            </p>
          </div>

          {/* Today Revenue */}
          <div className="flex-1 flex flex-col items-center gap-1 bg-green-50 p-2 rounded-lg border border-green-200">
            <TrendingUp className="w-5 h-5 text-green-600 mb-1" />
            <p className="text-[10px] text-muted-foreground font-medium uppercase text-center">Today Revenue</p>
            <p className="text-sm font-bold text-foreground">{hideValues ? '••' : formatCurrency(metrics?.todayRevenue || 0)}</p>
            <p className="text-[10px] text-green-600 text-center">
              {hideValues ? '••' : `+${formatCurrency(metrics?.todayPendingRevenue || 0)} pending`}
            </p>
          </div>

          {/* Available Balance */}
          <div className="flex-1 flex flex-col items-center gap-1 bg-blue-50 p-2 rounded-lg border border-blue-200">
            <DollarSign className="w-5 h-5 text-blue-600 mb-1" />
            <p className="text-[10px] text-muted-foreground font-medium uppercase text-center">Available</p>
            <p className="text-sm font-bold text-foreground">{hideValues ? '••' : formatCurrency(metrics?.availableBalance || 0)}</p>
            <p className="text-[10px] text-muted-foreground text-center">Ready for withdrawal</p>
          </div>

          {/* Pending Balance */}
          <div className="flex-1 flex flex-col items-center gap-1 bg-yellow-50 p-2 rounded-lg border border-yellow-200">
            <AlertCircle className="w-5 h-5 text-yellow-600 mb-1" />
            <p className="text-[10px] text-muted-foreground font-medium uppercase text-center">Pending</p>
            <p className="text-sm font-bold text-foreground">{hideValues ? '••' : formatCurrency(metrics?.pendingWithdrawals || 0)}</p>
            <p className="text-[10px] text-muted-foreground text-center">Awaiting settlement</p>
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-white border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Revenue Analytics</h2>
            <p className="text-xs text-muted-foreground mt-0.5">7-day performance metrics</p>
          </div>
          <Activity className="w-5 h-5 text-primary/50" />
        </div>

        {chartData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={isMobile ? 200 : 240}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={45} tickFormatter={formatYAxis} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '4px', color: 'hsl(var(--foreground))' }}
                  formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  strokeWidth={2}
                  name="Revenue"
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-2 text-xs">
              <div className="bg-primary/5 rounded p-3 border border-primary/10">
                <span className="text-muted-foreground">Total Revenue:</span>
                <p className="text-primary font-bold mt-1">{formatCurrency(metrics?.totalRevenue || 0)}</p>
              </div>
              <div className="bg-primary/5 rounded p-3 border border-primary/10">
                <span className="text-muted-foreground">Completed Orders:</span>
                <p className="text-primary font-bold mt-1">{metrics?.completedOrders || 0}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-xs">No data available for the last 7 days</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-border rounded-lg p-2">
        <h2 className="text-xs font-semibold mb-2">Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
          <Link href="/dashboard/menu">
            <Button variant="outline" className="w-full h-7 text-xs">
              Menu
            </Button>
          </Link>
          <Link href="/dashboard/orders">
            <Button variant="outline" className="w-full h-7 text-xs">
              Orders
            </Button>
          </Link>
          <Link href="/dashboard/share">
            <Button variant="outline" className="w-full h-7 text-xs">
              Share
            </Button>
          </Link>
          <Link href="/dashboard/finance">
            <Button variant="outline" className="w-full h-7 text-xs">
              Finance
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
