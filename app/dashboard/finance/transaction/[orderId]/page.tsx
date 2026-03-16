'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface TransactionDetails {
  id: string;
  order_id: string;
  customer_name: string;
  customer_email: string;
  total_amount: number;
  payment_status: string;
  payment_reference: string;
  paid_at: string;
  created_at: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
}

export default function TransactionDetailsPage() {
  const params = useParams();
  const orderId = params.orderId as string;
  const [transaction, setTransaction] = useState<TransactionDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchTransactionDetails = async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch transaction details');
        }

        const data = await response.json();
        setTransaction(data);
        setError('');
      } catch (err) {
        console.error('[v0] Error fetching transaction:', err);
        setError('Failed to load transaction details');
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchTransactionDetails();
    }
  }, [orderId]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  if (loading) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Transaction Details</h1>
        </div>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground text-sm">Loading transaction...</p>
        </div>
      </div>
    );
  }

  if (error || !transaction) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold mb-1">Transaction Details</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-2" />
          <p className="text-sm text-red-700">{error || 'Transaction not found'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/dashboard/finance">
          <Button variant="outline" size="sm" className="h-8">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Transaction Details</h1>
          <p className="text-xs text-muted-foreground">Order #{orderId.slice(0, 8)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Order Info */}
        <div className="bg-white border border-border rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-semibold">Order Information</h2>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Customer Name</p>
              <p className="text-sm font-medium">{transaction.customer_name}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Customer Email</p>
              <p className="text-sm font-medium">{transaction.customer_email}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Order Date</p>
              <p className="text-sm font-medium">
                {format(parseISO(transaction.created_at), 'MMM dd, yyyy hh:mm a')}
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Payment Status</p>
              <p className={`text-sm font-medium px-2 py-1 rounded inline-block mt-1 ${
                transaction.payment_status === 'completed'
                  ? 'bg-green-100 text-green-800'
                  : transaction.payment_status === 'pending'
                    ? 'bg-yellow-100 text-yellow-800'
                    : 'bg-red-100 text-red-800'
              }`}>
                {transaction.payment_status}
              </p>
            </div>
          </div>
        </div>

        {/* Payment Info */}
        <div className="bg-white border border-border rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-semibold">Payment Information</h2>

          <div className="space-y-3">
            <div>
              <p className="text-xs text-muted-foreground">Payment Reference</p>
              <p className="text-sm font-medium break-all">{transaction.payment_reference}</p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground">Amount</p>
              <p className="text-2xl font-bold text-green-600">
                {formatCurrency(transaction.total_amount)}
              </p>
            </div>

            {transaction.paid_at && (
              <div>
                <p className="text-xs text-muted-foreground">Paid At</p>
                <p className="text-sm font-medium">
                  {format(parseISO(transaction.paid_at), 'MMM dd, yyyy hh:mm a')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-white border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-4">Order Items</h2>

        <div className="space-y-2">
          {transaction.items && transaction.items.length > 0 ? (
            <>
              {transaction.items.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-sm font-medium">{formatCurrency(item.price * item.quantity)}</p>
                </div>
              ))}

              <div className="flex items-center justify-between py-3 border-t border-border font-semibold">
                <p>Total</p>
                <p>{formatCurrency(transaction.total_amount)}</p>
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">No items found</p>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <Link href={`/dashboard/orders/${orderId}`} className="flex-1">
          <Button variant="outline" className="w-full h-9">
            View Order Details
          </Button>
        </Link>

        {transaction.payment_status === 'completed' && (
          <Link href={`/dashboard/finance/transaction/${orderId}/refund`} className="flex-1">
            <Button className="w-full h-9 bg-red-600 hover:bg-red-700 text-white">
              Request Refund
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
