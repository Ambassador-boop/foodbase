'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, Loader } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface OrderDetails {
  id: string;
  customer_name: string;
  total_amount: number;
  payment_status: string;
}

export default function RefundPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [refundData, setRefundData] = useState({
    amount: '',
    reason: '',
    notes: '',
  });

  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        const response = await fetch(`/api/orders/${orderId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch order details');
        }

        const data = await response.json();
        setOrder(data);
        setRefundData((prev) => ({
          ...prev,
          amount: data.total_amount.toString(),
        }));
      } catch (err) {
        console.error('[v0] Error fetching order:', err);
        setError('Failed to load order details');
      } finally {
        setLoading(false);
      }
    };

    if (orderId) {
      fetchOrderDetails();
    }
  }, [orderId]);

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!refundData.amount || parseFloat(refundData.amount) <= 0) {
      setError('Please enter a valid refund amount');
      return;
    }

    if (!refundData.reason) {
      setError('Please select a reason for refund');
      return;
    }

    const refundAmount = parseFloat(refundData.amount);

    if (order && refundAmount > order.total_amount) {
      setError('Refund amount cannot exceed original transaction amount');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/refunds/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          amount: refundAmount,
          reason: refundData.reason,
          notes: refundData.notes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to request refund');
      }

      // Redirect to refund details page
      router.push(`/dashboard/finance/refunds/${data.refundId}`);
    } catch (err) {
      console.error('[v0] Refund request error:', err);
      setError(err instanceof Error ? err.message : 'Failed to request refund');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link href={`/dashboard/finance/transaction/${orderId}`}>
            <Button variant="outline" size="sm" className="h-8">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Request Refund</h1>
        </div>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground text-sm">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/finance">
            <Button variant="outline" size="sm" className="h-8">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Request Refund</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-2" />
          <p className="text-sm text-red-700 text-center">Order not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href={`/dashboard/finance/transaction/${orderId}`}>
          <Button variant="outline" size="sm" className="h-8">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Request Refund</h1>
          <p className="text-xs text-muted-foreground">Order #{orderId.slice(0, 8)}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleRefundSubmit} className="space-y-4">
        {/* Order Summary */}
        <div className="bg-white border border-border rounded-lg p-4">
          <h2 className="text-sm font-semibold mb-3">Order Summary</h2>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Customer</p>
              <p className="text-sm font-medium">{order.customer_name}</p>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <p className="text-sm font-semibold">Original Amount</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(order.total_amount)}</p>
            </div>
          </div>
        </div>

        {/* Refund Form */}
        <div className="bg-white border border-border rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-semibold">Refund Details</h2>

          {/* Refund Amount */}
          <div>
            <label className="text-xs font-semibold block mb-2">Refund Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₦</span>
              <input
                type="number"
                step="0.01"
                max={order.total_amount}
                value={refundData.amount}
                onChange={(e) => setRefundData({ ...refundData, amount: e.target.value })}
                className="w-full pl-8 pr-3 py-2 border border-input rounded text-sm"
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Max: {formatCurrency(order.total_amount)}
            </p>
          </div>

          {/* Reason */}
          <div>
            <label className="text-xs font-semibold block mb-2">Reason for Refund *</label>
            <select
              value={refundData.reason}
              onChange={(e) => setRefundData({ ...refundData, reason: e.target.value })}
              className="w-full px-3 py-2 border border-input rounded text-sm"
            >
              <option value="">Select a reason</option>
              <option value="customer_request">Customer Request</option>
              <option value="wrong_order">Wrong Order Delivered</option>
              <option value="damaged_item">Item Damaged</option>
              <option value="duplicate_charge">Duplicate Charge</option>
              <option value="payment_error">Payment Error</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-semibold block mb-2">Additional Notes</label>
            <textarea
              value={refundData.notes}
              onChange={(e) => setRefundData({ ...refundData, notes: e.target.value })}
              placeholder="Add any additional details about this refund..."
              rows={3}
              className="w-full px-3 py-2 border border-input rounded text-sm resize-none"
            />
          </div>
        </div>

        {/* Important Note */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800">
            <strong>Note:</strong> Refund amount cannot exceed the original transaction amount. The refund will be processed through Paystack and may take 2-5 business days to reflect in the customer's account.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Link href={`/dashboard/finance/transaction/${orderId}`} className="flex-1">
            <Button variant="outline" className="w-full h-9">
              Cancel
            </Button>
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 h-9 bg-primary text-white rounded hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium"
          >
            {submitting ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Request Refund'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
