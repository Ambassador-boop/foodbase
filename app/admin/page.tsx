'use client';

import { useEffect, useState } from 'react';
import { Building2, DollarSign, Users, AlertCircle, TrendingUp } from 'lucide-react';
import Link from 'next/link';

interface AdminMetrics {
  totalBusinesses: number;
  totalRevenue: number;
  totalOrders: number;
  totalUsers: number;
}

export default function AdminPage() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/admin/metrics');
        const data = await response.json();

        if (!response.ok) throw new Error(data.error);

        setMetrics(data);
      } catch (err) {
        setError('Failed to load metrics');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

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
        <h1 className="text-2xl font-bold mb-1">Admin Dashboard</h1>
        <p className="text-xs text-muted-foreground">Platform overview and management</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Grid */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Businesses</p>
                <p className="text-2xl font-bold text-foreground">{metrics.totalBusinesses}</p>
              </div>
              <Building2 className="w-5 h-5 text-primary/40 flex-shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground mt-3">Active restaurants</p>
          </div>

          <div className="bg-white border border-border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Orders</p>
                <p className="text-2xl font-bold text-foreground">{metrics.totalOrders}</p>
              </div>
              <TrendingUp className="w-5 h-5 text-accent/40 flex-shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground mt-3">All-time orders</p>
          </div>

          <div className="bg-white border border-border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(metrics.totalRevenue)}</p>
              </div>
              <DollarSign className="w-5 h-5 text-green-500/40 flex-shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground mt-3">Platform revenue</p>
          </div>

          <div className="bg-white border border-border rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Users</p>
                <p className="text-2xl font-bold text-foreground">{metrics.totalUsers}</p>
              </div>
              <Users className="w-5 h-5 text-blue-500/40 flex-shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground mt-3">Admin & business owners</p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Link href="/admin/businesses">
            <button className="w-full px-3 py-2 text-xs border border-border rounded hover:bg-muted/5 transition-colors font-medium">
              View Businesses
            </button>
          </Link>
          <Link href="/admin/withdrawals">
            <button className="w-full px-3 py-2 text-xs border border-border rounded hover:bg-muted/5 transition-colors font-medium">
              Approve Withdrawals
            </button>
          </Link>
          <Link href="/admin/users">
            <button className="w-full px-3 py-2 text-xs border border-border rounded hover:bg-muted/5 transition-colors font-medium">
              Manage Users
            </button>
          </Link>
          <Link href="/admin/settings">
            <button className="w-full px-3 py-2 text-xs border border-border rounded hover:bg-muted/5 transition-colors font-medium">
              Platform Settings
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
