'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BarChart3,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import TopSellingItems from '@/components/dashboard/top-selling-items';
import PeakHours from '@/components/dashboard/peak-hours';
import CustomerMetrics from '@/components/dashboard/customer-metrics';
import ComparativeMetrics from '@/components/dashboard/comparative-metrics';
import OrderStatusMix from '@/components/dashboard/order-status-mix';
import WeekdayBreakdown from '@/components/dashboard/weekday-breakdown';
import TimeRangeSelector from '@/components/dashboard/time-range-selector';

type TimeRange = 'today' | 'week' | 'month' | 'last30' | 'custom';
type RangeCode = '7d' | '30d' | '90d';

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [advancedRange, setAdvancedRange] = useState<RangeCode>('30d');

  return (
    <div className="space-y-5 pb-8">
      {/* Hero header — prominent bar at top */}
      <header className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-5 sm:p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <Link
            href="/dashboard"
            className="w-9 h-9 rounded-lg border border-border bg-background hover:bg-muted flex items-center justify-center transition-colors flex-shrink-0"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 mb-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                Analytics & Insights
              </h1>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              Detailed performance metrics and behavioral insights · All times in
              West Africa Time
            </p>
          </div>
        </div>
      </header>

      {/* Today vs Yesterday — instant comparisons */}
      <ComparativeMetrics />

      {/* Time range selector for chart + items + hours */}
      <section className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">Period selector</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Filters Top Sellers & Peak Hours below
          </p>
        </div>
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </section>

      {/* Top sellers + Peak hours */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <TopSellingItems timeRange={timeRange} />
        <PeakHours timeRange={timeRange} />
      </section>

      {/* Customer insights — expanded with total customers + returning */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Customer insights</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Retention, value, and acquisition trends
            </p>
          </div>
        </div>
        <CustomerMetrics />
      </section>

      {/* Range selector for advanced widgets */}
      <section className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="inline-flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <h2 className="text-base font-semibold">Deep-dive analytics</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Weekday / status breakdowns
          </p>
        </div>
        <div className="inline-flex items-center gap-1 p-1 rounded-full bg-muted">
          {(['7d', '30d', '90d'] as RangeCode[]).map((r) => (
            <button
              key={r}
              onClick={() => setAdvancedRange(r)}
              className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                advancedRange === r
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </section>

      {/* Best weekdays + Order status mix */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <WeekdayBreakdown range={advancedRange} />
        <OrderStatusMix range={advancedRange} />
      </section>

      {/* Footer help text */}
      <section className="rounded-xl border border-border bg-muted/30 p-4 text-center">
        <p className="text-xs text-muted-foreground">
          All data is filtered for paid orders only. West Africa Time (WAT) is
          UTC+1.
          <br />
          Need help interpreting these numbers?{' '}
          <Link href="/support" className="font-semibold text-primary hover:underline">
            Contact support
          </Link>
        </p>
      </section>
    </div>
  );
}
