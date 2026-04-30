'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  TrendingUp,
  Trophy,
  Loader2,
  ChevronRight,
  ImageIcon,
} from 'lucide-react';

interface TopSellingItem {
  id: string;
  name: string;
  imageUrl: string;
  orderCount: number;
  price: number;
  totalRevenue: number;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);

const RANK_BADGE: Record<number, string> = {
  0: 'bg-amber-100 text-amber-800 border-amber-200',
  1: 'bg-slate-100 text-slate-700 border-slate-200',
  2: 'bg-orange-100 text-orange-700 border-orange-200',
};

export default function TopSellingItems({
  timeRange = 'today',
}: {
  timeRange?: string;
}) {
  const [items, setItems] = useState<TopSellingItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchTopItems = async () => {
      setLoading(true);
      try {
        const businessId =
          typeof window !== 'undefined'
            ? localStorage.getItem('currentBusinessId')
            : null;
        const params = new URLSearchParams({
          sort: 'order_count',
          limit: '6',
          timeRange,
        });
        if (businessId) params.append('businessId', businessId);

        const response = await fetch(
          `/api/business/menu-items?${params.toString()}`,
          { cache: 'no-store' },
        );
        if (response.ok) {
          const data = await response.json();
          if (!cancelled) setItems(data.items || []);
        }
      } catch (error) {
        console.error('Failed to fetch top items:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchTopItems();
    return () => {
      cancelled = true;
    };
  }, [timeRange]);

  const maxCount = items.reduce((m, i) => Math.max(m, i.orderCount), 0);

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 h-full flex flex-col">
      <header className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold">Top sellers</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              By order count
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/menu"
          className="text-xs font-medium text-primary inline-flex items-center gap-1 hover:underline"
        >
          Menu <ChevronRight className="w-3 h-3" />
        </Link>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-8 flex-1">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : items.length > 0 ? (
        <ul className="flex flex-col gap-2.5 flex-1">
          {items.map((item, idx) => {
            const pct = maxCount > 0 ? (item.orderCount / maxCount) * 100 : 0;
            const rankBadge = RANK_BADGE[idx];
            return (
              <li
                key={item.id}
                className="group flex items-center gap-3 p-2.5 rounded-xl border border-border bg-background hover:border-primary/30 transition-colors"
              >
                <div className="relative w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt={item.name}
                      fill
                      sizes="48px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <ImageIcon className="w-4 h-4" />
                    </div>
                  )}
                  {rankBadge ? (
                    <div
                      className={`absolute -top-1 -left-1 w-5 h-5 rounded-full border text-[10px] font-bold flex items-center justify-center ${rankBadge}`}
                    >
                      {idx + 1}
                    </div>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate">
                      {!rankBadge ? (
                        <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-muted text-[10px] font-bold text-muted-foreground mr-1.5">
                          {idx + 1}
                        </span>
                      ) : null}
                      {item.name}
                    </p>
                    <p className="text-sm font-bold text-primary tabular-nums whitespace-nowrap">
                      {item.orderCount}
                    </p>
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-primary/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-muted-foreground whitespace-nowrap tabular-nums">
                      {formatCurrency(item.totalRevenue || 0)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="text-center py-8 flex-1 flex flex-col items-center justify-center gap-2">
          <TrendingUp className="w-6 h-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            No sales data for this window
          </p>
        </div>
      )}
    </section>
  );
}
