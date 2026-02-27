'use client';

import { useEffect, useState } from 'react';
import { AlertCircle } from 'lucide-react';

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Placeholder for future orders fetching
    setLoading(false);
  }, []);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-1">Orders</h1>
        <p className="text-xs text-muted-foreground">View and manage incoming customer orders</p>
      </div>

      {orders.length === 0 && (
        <div className="bg-white border border-border rounded-lg p-12 text-center">
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm font-medium mb-1">No orders yet</p>
          <p className="text-xs text-muted-foreground">
            Share your restaurant with customers to start receiving orders
          </p>
        </div>
      )}
    </div>
  );
}
