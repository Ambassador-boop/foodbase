'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, Loader } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface RefundDetails {
  id: string;
  order_id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  reason: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  failure_reason?: string;
}

export default function RefundDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const refundId = params.refundId as string;

  const [refund, setRefund] = useState<RefundDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const fetchRefundDetails = async () => {
      try {
        const response = await fetch(`/api/refunds/${refundId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch refund details');
        }

        const data = await response.json();
        setRefund(data);
      } catch (err) {
        console.error('[v0] Error fetching refund:', err);
        setError('Failed to load refund details');
      } finally {
        setLoading(false);
      }
    };

    if (refundId) {
      fetchRefundDetails();
    }
  }, [refundId]);

  const handleRetryRefund = async () => {
    setRetrying(true);
    setError('');

    try {
      const response = await fetch(`/api/refunds/${refundId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to retry refund');
      }

      // Refresh refund details
      const refreshResponse = await fetch(`/api/refunds/${refundId}`);
      if (refreshResponse.ok) {
        const updatedRefund = await refreshResponse.json();
        setRefund(updatedRefund);
      }
    } catch (err) {
      console.error('[v0] Retry error:', err);
      setError(err instanceof Error ? err.message : 'Failed to retry refund');
    } finally {
      setRetrying(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/finance">
            <Button variant="outline" size="sm" className="h-8">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Refund Details</h1>
        </div>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground text-sm">Loading refund details...</p>
        </div>
      </div>
    );
  }

  if (!refund) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/finance">
            <Button variant="outline" size="sm" className="h-8">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Refund Details</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-2" />
          <p className="text-sm text-red-700 text-center">Refund not found</p>
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
          <h1 className="text-2xl font-bold">Refund Details</h1>
          <p className="text-xs text-muted-foreground">Refund #{refundId.slice(0, 8)}</p>
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

      {/* Refund Status */}
      <div className="bg-white border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Refund Status</h2>
          <span className={`px-3 py-1 rounded text-xs font-medium capitalize ${getStatusColor(refund.status)}`}>
            {refund.status}
          </span>
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Refund Amount</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(refund.amount)}</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Related Order</p>
            <Link href={`/dashboard/orders/${refund.order_id}`}>
              <p className="text-sm font-medium text-blue-600 hover:underline">
                Order #{refund.order_id.slice(0, 8)}
              </p>
            </Link>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Reason</p>
            <p className="text-sm font-medium capitalize">{refund.reason.replace(/_/g, ' ')}</p>
          </div>

          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="text-sm font-medium">
              {format(parseISO(refund.created_at), 'MMM dd, yyyy hh:mm a')}
            </p>
          </div>

          {refund.notes && (
            <div>
              <p className="text-xs text-muted-foreground">Notes</p>
              <p className="text-sm">{refund.notes}</p>
            </div>
          )}

          {refund.failure_reason && (
            <div>
              <p className="text-xs text-muted-foreground">Failure Reason</p>
              <p className="text-sm text-red-600">{refund.failure_reason}</p>
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {refund.status === 'failed' && (
          <button
            onClick={handleRetryRefund}
            disabled={retrying}
            className="flex-1 h-9 bg-orange-600 text-white rounded hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium"
          >
            {retrying ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Retrying...
              </>
            ) : (
              'Retry Refund'
            )}
          </button>
        )}

        <Link href={`/dashboard/finance/transaction/${refund.order_id}`} className="flex-1">
          <Button variant="outline" className="w-full h-9">
            View Transaction
          </Button>
        </Link>
      </div>
    </div>
  );
}
