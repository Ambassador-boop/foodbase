'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ComparativeData {
  metric: string;
  today: number;
  yesterday: number;
  changePercent: number;
  isIncrease: boolean;
}

export default function ComparativeMetrics() {
  const [comparisons, setComparisons] = useState<ComparativeData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchComparisons = async () => {
      try {
        const response = await fetch('/api/business/dashboard/comparisons');
        if (response.ok) {
          const data = await response.json();
          setComparisons(data.comparisons || []);
        }
      } catch (error) {
        console.error('Failed to fetch comparison data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchComparisons();
  }, []);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(amount);

  if (loading) {
    return (
      <div className="bg-white border border-border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">Loading comparisons...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-border rounded-lg p-4">
      <h3 className="text-sm font-semibold text-foreground mb-4">Today vs Yesterday</h3>

      {comparisons.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {comparisons.map((item, idx) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{item.metric}</p>
                <p className="text-lg font-bold text-foreground">
                  {typeof item.today === 'number' && item.today > 100
                    ? formatCurrency(item.today)
                    : item.today}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  vs {typeof item.yesterday === 'number' && item.yesterday > 100
                    ? formatCurrency(item.yesterday)
                    : item.yesterday} yesterday
                </p>
              </div>
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg ${
                item.isIncrease
                  ? 'bg-green-100 text-green-700'
                  : 'bg-red-100 text-red-700'
              }`}>
                {item.isIncrease ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <span className="text-sm font-semibold">{item.changePercent.toFixed(0)}%</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground">No comparison data available</p>
        </div>
      )}
    </div>
  );
}
