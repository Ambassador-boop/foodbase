'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { TrendingUp, AlertCircle, DollarSign, ShoppingCart, Activity } from 'lucide-react';
import Link from 'next/link';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Area, AreaChart } from 'recharts';
import { useIsMobile } from '@/hooks/use-mobile';

interface DashboardMetrics {
  totalOrders: number;
  todayRevenue: number;
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

      {/* Metrics Card - Professional Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Orders */}
        <div className="bg-white border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Orders</p>
              <p className="text-2xl font-bold text-foreground mt-1">{metrics?.totalOrders || 0}</p>
              <p className="text-xs text-muted-foreground mt-2">Total orders placed</p>
            </div>
            <ShoppingCart className="w-8 h-8 text-primary/20 flex-shrink-0" />
          </div>
        </div>

        {/* Today's Revenue */}
        <div className="bg-white border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Today Revenue</p>
              <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(metrics?.todayRevenue || 0)}</p>
              <p className="text-xs text-muted-foreground mt-2">Current day earnings</p>
            </div>
            <TrendingUp className="w-8 h-8 text-primary/20 flex-shrink-0" />
          </div>
        </div>

        {/* Available Balance */}
        <div className="bg-white border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Available</p>
              <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(metrics?.availableBalance || 0)}</p>
              <p className="text-xs text-muted-foreground mt-2">Ready for withdrawal</p>
            </div>
            <DollarSign className="w-8 h-8 text-primary/20 flex-shrink-0" />
          </div>
        </div>

        {/* Pending Balance */}
        <div className="bg-white border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pending</p>
              <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(metrics?.pendingWithdrawals || 0)}</p>
              <p className="text-xs text-muted-foreground mt-2">Awaiting settlement</p>
            </div>
            <AlertCircle className="w-8 h-8 text-primary/20 flex-shrink-0" />
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
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={45} />
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
