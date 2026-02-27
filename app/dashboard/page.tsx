'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TrendingUp, AlertCircle, DollarSign, ShoppingCart } from 'lucide-react';
import Link from 'next/link';

interface DashboardMetrics {
  totalOrders: number;
  todayRevenue: number;
  availableBalance: number;
  pendingWithdrawals: number;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/business');
        const data = await response.json();

        if (!response.ok) throw new Error(data.error);

        const business = data.business;
        setMetrics({
          totalOrders: business.total_orders || 0,
          todayRevenue: 0,
          availableBalance: business.available_balance || 0,
          pendingWithdrawals: business.pending_balance || 0,
        });
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
        <h1 className="text-2xl font-bold mb-1">Dashboard</h1>
        <p className="text-xs text-muted-foreground">Overview of your restaurant performance</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total Orders</p>
              <p className="text-2xl font-bold text-foreground">{metrics?.totalOrders || 0}</p>
            </div>
            <ShoppingCart className="w-5 h-5 text-primary/40 flex-shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground mt-3">All-time orders</p>
        </div>

        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Today's Revenue</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(metrics?.todayRevenue || 0)}</p>
            </div>
            <TrendingUp className="w-5 h-5 text-accent/40 flex-shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground mt-3">Today only</p>
        </div>

        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(metrics?.availableBalance || 0)}</p>
            </div>
            <DollarSign className="w-5 h-5 text-green-500/40 flex-shrink-0" />
          </div>
          <Link href="/dashboard/finance">
            <Button variant="outline" className="w-full mt-3 h-7 text-xs">
              Request Withdrawal
            </Button>
          </Link>
        </div>

        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Pending Withdrawals</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(metrics?.pendingWithdrawals || 0)}</p>
            </div>
            <AlertCircle className="w-5 h-5 text-warning/40 flex-shrink-0" />
          </div>
          <p className="text-xs text-muted-foreground mt-3">Available tomorrow</p>
        </div>
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

      {/* Getting Started */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold">Getting Started</h2>
        <ol className="text-xs text-muted-foreground space-y-2 list-decimal list-inside">
          <li><strong>Create Categories</strong> - Organize your menu into logical groups</li>
          <li><strong>Add Menu Items</strong> - Upload dishes with prices and images</li>
          <li><strong>Define Add-ons</strong> - Set up proteins, sides, and toppings</li>
          <li><strong>Add Drinks</strong> - Include beverage options</li>
          <li><strong>Share Your Store</strong> - Generate QR code for customers to order</li>
        </ol>
      </div>
    </div>
  );
}
