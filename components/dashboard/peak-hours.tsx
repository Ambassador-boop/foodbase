'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Clock } from 'lucide-react';

interface HourlyData {
  hour: string;
  orders: number;
  revenue: number;
}

export default function PeakHours({ timeRange = 'today' }: { timeRange?: string }) {
  const [data, setData] = useState<HourlyData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHourlyData = async () => {
      try {
        const businessId = localStorage.getItem('currentBusinessId');
        const url = businessId
          ? `/api/business/dashboard/hourly?timeRange=${timeRange}&businessId=${businessId}`
          : `/api/business/dashboard/hourly?timeRange=${timeRange}`;

        const response = await fetch(url);
        if (response.ok) {
          const result = await response.json();
          setData(result.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch hourly data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchHourlyData();
  }, [timeRange]);

  if (loading) {
    return (
      <div className="bg-white border border-border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">Loading chart...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Peak Hours</h3>
      </div>

      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="hour" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
            <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={35} />
            <Tooltip
              contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '4px' }}
              formatter={(value) => value}
              labelStyle={{ color: 'hsl(var(--foreground))' }}
            />
            <Bar dataKey="orders" fill="hsl(var(--primary))" name="Orders" />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">No hourly data available</p>
        </div>
      )}
    </div>
  );
}
