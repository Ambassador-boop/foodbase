'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface WithdrawalDetails {
  id: string;
  amount: number;
  service_fee: number;
  status: 'pending' | 'completed' | 'failed';
  bank_account_number?: string;
  created_at: string;
  updated_at: string;
  failure_reason?: string;
}

export default function WithdrawalDetailsPage() {
  const params = useParams();
  const withdrawalId = params.withdrawalId as string;

  const [withdrawal, setWithdrawal] = useState<WithdrawalDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchWithdrawalDetails = async () => {
      try {
        const response = await fetch(`/api/withdrawals/${withdrawalId}`);

        if (!response.ok) {
          throw new Error('Failed to fetch withdrawal details');
        }

        const data = await response.json();
        setWithdrawal(data);
      } catch (err) {
        console.error('[v0] Error fetching withdrawal:', err);
        setError('Failed to load withdrawal details');
      } finally {
        setLoading(false);
      }
    };

    if (withdrawalId) {
      fetchWithdrawalDetails();
    }
  }, [withdrawalId]);

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
          <h1 className="text-2xl font-bold">Withdrawal Details</h1>
        </div>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground text-sm">Loading withdrawal details...</p>
        </div>
      </div>
    );
  }

  if (!withdrawal) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/finance">
            <Button variant="outline" size="sm" className="h-8">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold">Withdrawal Details</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <AlertCircle className="w-8 h-8 mx-auto text-red-500 mb-2" />
          <p className="text-sm text-red-700 text-center">Withdrawal not found</p>
        </div>
      </div>
    );
  }

  const netAmount = withdrawal.amount - withdrawal.service_fee;

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
          <h1 className="text-2xl font-bold">Withdrawal Details</h1>
          <p className="text-xs text-muted-foreground">Withdrawal #{withdrawalId.slice(0, 8)}</p>
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

      {/* Withdrawal Status */}
      <div className="bg-white border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold">Withdrawal Status</h2>
          <span className={`px-3 py-1 rounded text-xs font-medium capitalize ${getStatusColor(withdrawal.status)}`}>
            {withdrawal.status}
          </span>
        </div>

        <div className="space-y-3">
          <div className="bg-gray-50 rounded p-3 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Gross Amount</p>
              <p className="text-sm font-medium">{formatCurrency(withdrawal.amount)}</p>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Service Fee (7.5%)</p>
              <p className="text-sm font-medium text-red-600">-{formatCurrency(withdrawal.service_fee)}</p>
            </div>

            <div className="pt-2 border-t border-border flex items-center justify-between">
              <p className="text-xs font-semibold">Net Amount</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(netAmount)}</p>
            </div>
          </div>

          {withdrawal.bank_account_number && (
            <div>
              <p className="text-xs text-muted-foreground">Bank Account</p>
              <p className="text-sm font-medium">...{withdrawal.bank_account_number.slice(-4)}</p>
            </div>
          )}

          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="text-sm font-medium">
              {format(parseISO(withdrawal.created_at), 'MMM dd, yyyy hh:mm a')}
            </p>
          </div>

          {withdrawal.failure_reason && (
            <div>
              <p className="text-xs text-muted-foreground">Failure Reason</p>
              <p className="text-sm text-red-600">{withdrawal.failure_reason}</p>
            </div>
          )}
        </div>
      </div>

      {/* Info Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-xs text-blue-800">
          <strong>Note:</strong> Withdrawal typically arrives within 1-2 business days. If status remains pending after 48 hours, please contact support.
        </p>
      </div>

      {/* Actions */}
      <Link href="/dashboard/finance">
        <Button variant="outline" className="w-full h-9">
          Back to Finance
        </Button>
      </Link>
    </div>
  );
}
