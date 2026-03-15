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

      {/* Metrics Card - Compact Grid */}
      <div className="bg-white border border-border rounded-lg p-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Total Orders */}
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">Orders</p>
              <p className="text-sm font-bold text-foreground">{metrics?.totalOrders || 0}</p>
            </div>
          </div>

          {/* Today's Revenue */}
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">Today</p>
              <p className="text-sm font-bold text-foreground truncate">{formatCurrency(metrics?.todayRevenue || 0)}</p>
            </div>
          </div>

          {/* Available Balance */}
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">Available</p>
              <p className="text-sm font-bold text-foreground truncate">{formatCurrency(metrics?.availableBalance || 0)}</p>
            </div>
          </div>

          {/* Pending */}
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">Pending</p>
              <p className="text-sm font-bold text-foreground truncate">{formatCurrency(metrics?.pendingWithdrawals || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Chart - Nerd Design */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-mono font-bold text-cyan-400">REVENUE_ANALYTICS</h2>
            <p className="text-xs text-slate-400 mt-0.5">7-day performance metrics</p>
          </div>
          <Activity className="w-5 h-5 text-green-400 animate-pulse" />
        </div>
        
        {chartData.length > 0 ? (
          <>
            <ResponsiveContainer width="100%" height={isMobile ? 200 : 240}>
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} width={45} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '4px' }}
                  formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
                  labelStyle={{ color: '#06b6d4' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#06b6d4" 
                  fillOpacity={1} 
                  fill="url(#colorRevenue)" 
                  strokeWidth={2}
                  name="Revenue"
                />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-2 gap-2 text-xs">
              <div className="bg-slate-800 rounded p-2">
                <span className="text-slate-400">Total Revenue:</span>
                <p className="text-green-400 font-mono font-bold mt-1">{formatCurrency(metrics?.totalRevenue || 0)}</p>
              </div>
              <div className="bg-slate-800 rounded p-2">
                <span className="text-slate-400">Completed Orders:</span>
                <p className="text-blue-400 font-mono font-bold mt-1">{metrics?.completedOrders || 0}</p>
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-slate-400 text-xs font-mono">[ NO_DATA_AVAILABLE ]</p>
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
