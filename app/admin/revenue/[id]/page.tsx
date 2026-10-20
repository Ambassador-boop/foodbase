'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertCircle, Loader } from 'lucide-react';

interface TransactionDetails {
  transaction: {
    id: string;
    order_id: string;
    service_fee_amount: number;
    service_fee_type: string;
    created_at: string;
    total_amount: number;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    address: string;
    order_status: string;
    payment_status: string;
    business_name: string;
    paid_at: string;
  };
  orderItems: Array<{
    id: string;
    menu_item_id: string;
    quantity: number;
    item_price: number;
    item_name: string;
  }>;
}

export default function TransactionDetailsPage() {
  const params = useParams<{ id: string }>();
  const { id } = params;

  const [data, setData] = useState<TransactionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTransactionDetails();
  }, [id]);

  const fetchTransactionDetails = async () => {
    try {
      const response = await fetch(`/api/admin/revenue/${id}`, {
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to fetch transaction details');
        return;
      }

      setData(data);
    } catch (err) {
      console.error('[v0] Error fetching transaction:', err);
      setError('Failed to load transaction details');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/revenue/transactions">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Transaction Details</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  const tx = data.transaction;
  const subtotal = tx.total_amount - tx.service_fee_amount;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/revenue/transactions">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Transaction Details</h1>
          <p className="text-xs text-muted-foreground">Order {tx.order_id}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Order Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Transaction Summary */}
          <div className="bg-white border border-border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold">Transaction Summary</h2>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-xs text-muted-foreground">Transaction ID</span>
                <span className="text-xs font-semibold">{tx.id}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-xs text-muted-foreground">Order ID</span>
                <span className="text-xs font-semibold">{tx.order_id}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-xs text-muted-foreground">Restaurant</span>
                <span className="text-xs font-semibold">{tx.business_name}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-xs text-muted-foreground">Status</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  tx.order_status === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}>
                  {tx.order_status}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-xs text-muted-foreground">Payment Status</span>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                  tx.payment_status === 'success'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {tx.payment_status}
                </span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-xs text-muted-foreground">Date</span>
                <span className="text-xs font-semibold">{formatDate(tx.created_at)}</span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span className="text-xs text-muted-foreground">Paid At</span>
                <span className="text-xs font-semibold">{formatDate(tx.paid_at)}</span>
              </div>
            </div>
          </div>

          {/* Customer Details */}
          <div className="bg-white border border-border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold">Customer Information</h2>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Name</p>
                <p className="text-xs font-semibold">{tx.customer_name}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Email</p>
                <p className="text-xs font-semibold">{tx.customer_email}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Phone</p>
                <p className="text-xs font-semibold">{tx.customer_phone}</p>
              </div>

              <div>
                <p className="text-xs text-muted-foreground mb-1">Delivery Address</p>
                <p className="text-xs font-semibold">{tx.address}</p>
              </div>
            </div>
          </div>

          {/* Order Items */}
          <div className="bg-white border border-border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold">Order Items</h2>

            {data.orderItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">No items found</p>
            ) : (
              <div className="space-y-2">
                {data.orderItems.map((item) => (
                  <div key={item.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                    <div>
                      <p className="text-xs font-semibold">{item.item_name || 'Unknown Item'}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-xs font-semibold">{formatCurrency(Number(item.item_price) * item.quantity || 0)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Financial Summary */}
        <div className="space-y-6">
          {/* Payment Breakdown */}
          <div className="bg-white border border-border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold text-sm">Payment Breakdown</h2>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-xs text-muted-foreground">Subtotal</span>
                <span className="text-xs font-semibold">{formatCurrency(subtotal)}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-xs text-muted-foreground">Service Fee</span>
                <span className="text-xs font-semibold text-green-600">{formatCurrency(tx.service_fee_amount)}</span>
              </div>

              <div className="flex justify-between items-center py-3 bg-primary/5 px-3 rounded font-semibold">
                <span className="text-xs">Total Amount</span>
                <span className="text-sm text-primary">{formatCurrency(tx.total_amount)}</span>
              </div>
            </div>

            {/* Fee Type Info */}
            <div className="bg-primary/5 border border-primary/20 rounded p-3">
              <p className="text-xs font-semibold text-primary mb-1">Fee Type</p>
              <p className="text-xs text-muted-foreground">{tx.service_fee_type === 'tiered' ? 'Tiered Service Fee' : 'Legacy Percentage (7.5%)'}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
