'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { TrendingUp } from 'lucide-react';

interface TopSellingItem {
  id: string;
  name: string;
  imageUrl: string;
  orderCount: number;
  price: number;
  totalRevenue: number;
}

export default function TopSellingItems({ timeRange = 'today' }: { timeRange?: string }) {
  const [items, setItems] = useState<TopSellingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTopItems = async () => {
      try {
        const businessId = localStorage.getItem('currentBusinessId');
        const params = new URLSearchParams({ sort: 'order_count', limit: '6', timeRange });
        if (businessId) {
          params.append('businessId', businessId);
        }

        const response = await fetch(`/api/business/menu-items?${params.toString()}`);
        if (response.ok) {
          const data = await response.json();
          setItems(data.items || []);
        }
      } catch (error) {
        console.error('Failed to fetch top items:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTopItems();
  }, [timeRange]);

  if (loading) {
    return (
      <div className="bg-white border border-border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">Loading top sellers...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-5 h-5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Top Selling Items</h3>
      </div>

      {items.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {items.map((item) => (
            <div key={item.id} className="flex-shrink-0 w-32 flex flex-col items-center gap-2 p-3 bg-muted/30 rounded-lg">
              <div className="relative w-24 h-24 bg-muted rounded-md overflow-hidden">
                {item.imageUrl ? (
                  <Image
                    src={item.imageUrl}
                    alt={item.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <span className="text-xs text-muted-foreground">No image</span>
                  </div>
                )}
              </div>
              <p className="text-xs font-medium text-center text-foreground line-clamp-2">{item.name}</p>
              <div className="text-center">
                <p className="text-lg font-bold text-primary">{item.orderCount}</p>
                <p className="text-[10px] text-muted-foreground">sold</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground">No sales data available</p>
        </div>
      )}
    </div>
  );
}
