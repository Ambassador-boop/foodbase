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
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await fetch('/api/business/dashboard', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
        <p className="text-xs text-muted-foreground">Overview of your restaurant performance</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Card - Rectangular Single Card */}
      <div className="bg-white border border-border rounded-lg p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {/* Total Orders */}
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <ShoppingCart className="w-8 h-8 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Orders</p>
              <p className="text-2xl font-bold text-foreground">{metrics?.totalOrders || 0}</p>
            </div>
          </div>

          {/* Today's Revenue */}
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <TrendingUp className="w-8 h-8 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Today's Revenue</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(metrics?.todayRevenue || 0)}</p>
            </div>
          </div>

          {/* Available Balance */}
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <DollarSign className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(metrics?.availableBalance || 0)}</p>
            </div>
          </div>

          {/* Pending */}
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0">
              <AlertCircle className="w-8 h-8 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Pending</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(metrics?.pendingWithdrawals || 0)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Revenue Chart */}
      <div className="bg-white border border-border rounded-lg p-6">
        <h2 className="text-sm font-semibold mb-4">Revenue Overview (Last 7 Days)</h2>
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={isMobile ? 250 : 300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">No revenue data available yet</p>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Link href="/dashboard/menu">
            <Button variant="outline" className="w-full h-8 text-xs">
              Add Menu Item
            </Button>
          </Link>
          <Link href="/dashboard/orders">
            <Button variant="outline" className="w-full h-8 text-xs">
              View Orders
            </Button>
          </Link>
          <Link href="/dashboard/share">
            <Button variant="outline" className="w-full h-8 text-xs">
              Share Business
            </Button>
          </Link>
          <Link href="/dashboard/finance">
            <Button variant="outline" className="w-full h-8 text-xs">
              Finance
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
