'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { AlertCircle, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

interface Order {
  id: string;
  customer_name: string;
  customer_phone: string;
  address: string;
  status: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
  business_name: string;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isMobile = useIsMobile();

  const fetchOrders = useCallback(async () => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        setError('Authentication required');
        return;
      }

      const response = await fetch('/api/business/orders', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      const data = await response.json();
      setOrders(data);
      setError('');
    } catch (err) {
      console.error('Error fetching orders:', err);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();

    // Poll for new orders every 5 seconds
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'cancelled':
        return <AlertTriangle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Orders</h1>
          <p className="text-xs text-muted-foreground">View and manage incoming customer orders</p>
        </div>
        <div className="text-center py-8">
          <Clock className="w-8 h-8 animate-spin mx-auto text-primary mb-2" />
          <p className="text-sm text-muted-foreground">Loading orders...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Orders</h1>
          <p className="text-xs text-muted-foreground">View and manage incoming customer orders</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-2" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-1">Orders</h1>
        <p className="text-xs text-muted-foreground">View and manage incoming customer orders</p>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white border border-border rounded-lg p-12 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium mb-1">No orders yet</p>
          <p className="text-xs text-muted-foreground">
            Share your restaurant with customers to start receiving orders
          </p>
        </div>
      ) : isMobile ? (
        // Mobile Card Layout
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/dashboard/orders/${order.id}`}
              className="block bg-white border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <p className="font-semibold text-sm text-gray-900">{order.customer_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Order #{order.id.slice(0, 8)}</p>
                </div>
                {getStatusIcon(order.status)}
              </div>

              <div className="space-y-2 mb-3">
                <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">{order.address}</p>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${getStatusColor(order.status)}`}>
                  {order.status}
                </span>
                <p className="font-semibold text-sm">{formatCurrency(order.total_amount)}</p>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        // Desktop Table Layout
        <div className="bg-white border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-xs text-muted-foreground">Customer</th>
                <th className="px-6 py-3 text-left font-semibold text-xs text-muted-foreground">Phone</th>
                <th className="px-6 py-3 text-left font-semibold text-xs text-muted-foreground">Address</th>
                <th className="px-6 py-3 text-left font-semibold text-xs text-muted-foreground">Status</th>
                <th className="px-6 py-3 text-left font-semibold text-xs text-muted-foreground">Amount</th>
                <th className="px-6 py-3 text-left font-semibold text-xs text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {orders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-sm">{order.customer_name}</p>
                    <p className="text-xs text-muted-foreground">#{order.id.slice(0, 8)}</p>
                  </td>
                  <td className="px-6 py-4 text-sm">{order.customer_phone}</td>
                  <td className="px-6 py-4 text-sm text-muted-foreground line-clamp-1">{order.address}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-semibold text-sm">{formatCurrency(order.total_amount)}</td>
                  <td className="px-6 py-4">
                    <Link href={`/dashboard/orders/${order.id}`}>
                      <Button variant="outline" size="sm" className="text-xs h-8">
                        View Details
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
