'use client';

import { useEffect, useState } from 'react';
import { Users, TrendingUp, RotateCcw } from 'lucide-react';

interface CustomerMetricsData {
  newCustomersToday: number;
  averageOrderValue: number;
  repeatCustomerRate: number;
}

export default function CustomerMetrics() {
  const [metrics, setMetrics] = useState<CustomerMetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const response = await fetch('/api/business/dashboard/customer-metrics');
        if (response.ok) {
          const data = await response.json();
          setMetrics(data.metrics);
        }
      } catch (error) {
        console.error('Failed to fetch customer metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  if (loading) {
    return (
      <div className="bg-white border border-border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">Loading metrics...</p>
      </div>
    );
  }

  if (!metrics) {
    return null;
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* New Customers Today */}
      <div className="bg-white border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">New Customers</h3>
          <Users className="w-5 h-5 text-blue-600" />
        </div>
        <p className="text-2xl font-bold text-foreground">{metrics.newCustomersToday}</p>
        <p className="text-xs text-muted-foreground mt-1">Today</p>
      </div>

      {/* Average Order Value */}
      <div className="bg-white border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Avg Order Value</h3>
          <TrendingUp className="w-5 h-5 text-green-600" />
        </div>
        <p className="text-2xl font-bold text-foreground">{formatCurrency(metrics.averageOrderValue)}</p>
        <p className="text-xs text-muted-foreground mt-1">Per order</p>
      </div>

      {/* Repeat Customer Rate */}
      <div className="bg-white border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-foreground">Repeat Rate</h3>
          <RotateCcw className="w-5 h-5 text-purple-600" />
        </div>
        <p className="text-2xl font-bold text-foreground">{metrics.repeatCustomerRate.toFixed(1)}%</p>
        <p className="text-xs text-muted-foreground mt-1">Returning customers</p>
      </div>
    </div>
  );
}
