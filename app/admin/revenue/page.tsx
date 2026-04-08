'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, TrendingUp, Building2, Calendar, Eye, AlertCircle, Loader } from 'lucide-react';

interface RevenueSummary {
  total_revenue: number;
  withdrawn_amount: number;
  available_balance: number;
  updated_at: string;
}

interface DailyBreakdown {
  date: string;
  transaction_count: number;
  daily_revenue: number;
}

interface TopRestaurant {
  id: string;
  name: string;
  transaction_count: number;
  restaurant_revenue: number;
}

interface RecentTransaction {
  id: string;
  order_id: string;
  service_fee_amount: number;
  service_fee_type: string;
  created_at: string;
  business_name: string;
}

export default function RevenuePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [dailyBreakdown, setDailyBreakdown] = useState<DailyBreakdown[]>([]);
  const [topRestaurants, setTopRestaurants] = useState<TopRestaurant[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<RecentTransaction[]>([]);

  useEffect(() => {
    fetchRevenueData();
  }, []);

  const fetchRevenueData = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/admin/revenue', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to fetch revenue data');
        return;
      }

      setSummary(data.summary);
      setDailyBreakdown(data.dailyBreakdown || []);
      setTopRestaurants(data.topRestaurants || []);
      setRecentTransactions(data.recentTransactions || []);
    } catch (err) {
      console.error('[v0] Error fetching revenue:', err);
      setError('Failed to load revenue data');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Revenue Dashboard</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">Revenue Dashboard</h1>
            <p className="text-xs text-muted-foreground">Platform service fee analytics</p>
          </div>
        </div>
        <Link href="/admin/revenue/withdraw">
          <Button
            size="sm"
            className="h-8 w-8 p-0 bg-primary text-white hover:bg-primary-dark"
            title="Withdraw Revenue"
          >
            <TrendingUp className="w-4 h-4" />
          </Button>
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Revenue */}
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Total Revenue</p>
              <p className="text-lg font-bold mt-2">{formatCurrency(summary?.total_revenue || 0)}</p>
            </div>
            <TrendingUp className="w-5 h-5 text-primary opacity-50" />
          </div>
        </div>

        {/* Available Balance */}
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Available Balance</p>
              <p className="text-lg font-bold mt-2 text-green-600">
                {formatCurrency(summary?.available_balance || 0)}
              </p>
            </div>
            <Calendar className="w-5 h-5 text-green-600 opacity-50" />
          </div>
        </div>

        {/* Withdrawn Amount */}
        <div className="bg-white border border-border rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-muted-foreground">Withdrawn</p>
              <p className="text-lg font-bold mt-2 text-blue-600">
                {formatCurrency(summary?.withdrawn_amount || 0)}
              </p>
            </div>
            <Building2 className="w-5 h-5 text-blue-600 opacity-50" />
          </div>
        </div>
      </div>

      {/* Daily Revenue Breakdown */}
      <div className="bg-white border border-border rounded-lg p-4">
        <h2 className="font-semibold text-sm mb-4">Daily Revenue (Last 30 Days)</h2>
        {dailyBreakdown.length === 0 ? (
          <p className="text-xs text-muted-foreground">No revenue data yet</p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {dailyBreakdown.map((day, idx) => (
              <div key={idx} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                <div>
                  <p className="text-xs font-medium">{formatDate(day.date)}</p>
                  <p className="text-xs text-muted-foreground">{day.transaction_count} transactions</p>
                </div>
                <p className="text-xs font-semibold">{formatCurrency(Number(day.daily_revenue) || 0)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Restaurants */}
      <div className="bg-white border border-border rounded-lg p-4">
        <h2 className="font-semibold text-sm mb-4">Top Restaurants by Revenue</h2>
        {topRestaurants.length === 0 ? (
          <p className="text-xs text-muted-foreground">No restaurant data yet</p>
        ) : (
          <div className="space-y-2">
            {topRestaurants.map((restaurant, idx) => (
              <div key={idx} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-bold text-primary">{idx + 1}</span>
                  </div>
                  <div>
                    <p className="text-xs font-medium">{restaurant.name}</p>
                    <p className="text-xs text-muted-foreground">{restaurant.transaction_count} orders</p>
                  </div>
                </div>
                <p className="text-xs font-semibold">{formatCurrency(Number(restaurant.restaurant_revenue) || 0)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Transactions Preview */}
      <div className="bg-white border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-sm">Recent Transactions</h2>
          <Link href="/admin/revenue/transactions">
            <Button variant="ghost" size="sm" className="h-6 text-xs gap-2">
              View All
              <Eye className="w-3 h-3" />
            </Button>
          </Link>
        </div>

        {recentTransactions.length === 0 ? (
          <p className="text-xs text-muted-foreground">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {recentTransactions.map((tx, idx) => (
              <div key={idx} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <div>
                  <p className="text-xs font-medium">{tx.business_name}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(tx.created_at)}</p>
                </div>
                <p className="text-xs font-semibold">{formatCurrency(Number(tx.service_fee_amount) || 0)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
