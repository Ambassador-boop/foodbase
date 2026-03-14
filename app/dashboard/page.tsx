'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { TrendingUp, AlertCircle, DollarSign, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useIsMobile } from '@/hooks/use-mobile';

interface DashboardMetrics {
  totalOrders: number;
  todayRevenue: number;
  availableBalance: number;
  pendingWithdrawals: number;
}

interface AnalyticsData {
  date: string;
  revenue: number;
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

      {/* Revenue Chart */}
      <div className="bg-white border border-border rounded-lg p-3">
        <h2 className="text-xs font-semibold mb-2">Revenue (7 Days)</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={isMobile ? 180 : 200}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-xs">No data</p>
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
