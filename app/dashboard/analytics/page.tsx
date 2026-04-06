'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BarChart3, TrendingUp } from 'lucide-react';
import TopSellingItems from '@/components/dashboard/top-selling-items';
import PeakHours from '@/components/dashboard/peak-hours';
import CustomerMetrics from '@/components/dashboard/customer-metrics';
import ComparativeMetrics from '@/components/dashboard/comparative-metrics';
import TimeRangeSelector from '@/components/dashboard/time-range-selector';

type TimeRange = 'today' | 'week' | 'month' | 'last30' | 'custom';

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('week');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="p-2 hover:bg-muted rounded">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Analytics & Insights
          </h1>
          <p className="text-sm text-muted-foreground">Detailed performance metrics</p>
        </div>
      </div>

      {/* Time Range Selector */}
      <div className="bg-white border border-border rounded-lg p-4">
        <p className="text-sm font-semibold mb-3">Select Time Period</p>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} showCustom={true} />
      </div>

      {/* Comparative Metrics */}
      <ComparativeMetrics />

      {/* Customer Metrics */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Customer Insights
        </h2>
        <CustomerMetrics />
      </div>

      {/* Top Selling Items */}
      <TopSellingItems timeRange={timeRange} />

      {/* Peak Hours */}
      <PeakHours timeRange={timeRange} />
    </div>
  );
}
