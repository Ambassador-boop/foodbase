'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Clock, ChevronRight } from 'lucide-react';

interface RecentOrder {
  id: string;
  customerName: string;
  totalAmount: number;
  createdAt: string;
  status: string;
  itemCount: number;
}

export default function RecentOrders() {
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch('/api/business/orders?limit=10&sort=latest');
        if (response.ok) {
          const data = await response.json();
          setOrders(data.orders || []);
        }
      } catch (error) {
        console.error('Failed to fetch orders:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrders();
  }, []);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  if (loading) {
    return (
      <div className="bg-white border border-border rounded-lg p-4">
        <p className="text-sm text-muted-foreground">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-border rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Recent Orders</h3>
        </div>
        <Link href="/dashboard/orders" className="text-xs text-primary hover:underline">
          View All
        </Link>
      </div>

      {orders.length > 0 ? (
        <div className="space-y-2">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/dashboard/orders/${order.id}`}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {order.customerName || 'Guest'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}
                </p>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{formatCurrency(order.totalAmount)}</p>
                  <p className="text-xs text-muted-foreground">{formatTime(order.createdAt)}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-sm text-muted-foreground">No orders yet</p>
        </div>
      )}
    </div>
  );
}
