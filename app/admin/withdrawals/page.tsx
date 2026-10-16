'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Loader, ChevronLeft, ChevronRight, CheckCircle, Clock, XCircle } from 'lucide-react';
import Link from 'next/link';

interface Withdrawal {
  id: string;
  business_id: string;
  business_name: string;
  amount: number;
  net_amount: number;
  withdrawal_fee: number;
  service_fee: number;
  bank_account_holder: string;
  bank_account_number: string;
  bank_code: string;
  status: 'pending' | 'completed' | 'failed' | 'rejected' | 'abandoned' | 'blocked';
  paystack_transfer_id: string | null;
  created_at: string;
  updated_at: string;
  requested_at: string;
  processed_at: string | null;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function WithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchWithdrawals(1);
  }, []);

  const fetchWithdrawals = async (page: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/business/withdrawals/admin?page=${page}&limit=20`, {
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to fetch withdrawals');
        return;
      }

      setWithdrawals(data.withdrawals || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('[v0] Error fetching withdrawals:', err);
      setError('Failed to load withdrawals');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const handlePageChange = (newPage: number) => {
    fetchWithdrawals(newPage);
  };

  const normalizeStatus = (status: string) => {
    const value = String(status).toLowerCase();
    if (value === 'success' || value === 'completed') return 'Completed';
    if (['pending', 'otp', 'received', 'queued', 'processing'].includes(value)) return 'Pending';
    if (['failed', 'rejected', 'abandoned', 'blocked', 'reversed'].includes(value)) return 'Failed';
    return 'Pending';
  };
  const getStatusIcon = (status: string) => {
    const normalized = normalizeStatus(status);
    if (normalized === 'Completed') return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (normalized === 'Failed') return <XCircle className="w-4 h-4 text-red-600" />;
    return <Clock className="w-4 h-4 text-amber-600" />;
  };
  const getStatusColor = (status: string) => {
    const normalized = normalizeStatus(status);
    if (normalized === 'Completed') return 'bg-green-100 text-green-800';
    if (normalized === 'Failed') return 'bg-red-100 text-red-800';
    return 'bg-amber-100 text-amber-800';
  };

  if (loading && withdrawals.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Withdrawals</h1>
        <p className="text-xs text-muted-foreground">Manage and monitor business withdrawal requests</p>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}

      {/* Withdrawals Table */}
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        {withdrawals.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground text-xs">No withdrawal requests found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Business</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Fee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Net Amount</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Requested</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Bank Account</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {withdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-background">
                      <td className="px-4 py-3 text-xs font-medium">{w.business_name}</td>
                      <td className="px-4 py-3 text-xs font-semibold">
                        {formatCurrency(Number(w.amount) || 0)}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatCurrency(Number(w.withdrawal_fee || w.service_fee) || 0)}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-green-600">
                        {formatCurrency(Number(w.net_amount) || 0)}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="flex items-center gap-2">
                          {getStatusIcon(w.status)}
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${getStatusColor(w.status)}`}>
                            {w.status}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(w.created_at || w.requested_at)}
                      </td>
                      <td className="px-4 py-3 text-xs font-mono">
                        {w.bank_account_number && (
                          <div className="flex flex-col">
                            <span>{w.bank_account_number}</span>
                            <span className="text-muted-foreground text-[10px]">{w.bank_account_holder}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-border flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} withdrawals
              </p>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1"
                  disabled={pagination.page === 1}
                  onClick={() => handlePageChange(pagination.page - 1)}
                >
                  <ChevronLeft className="w-3 h-3" />
                </Button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === pagination.totalPages || Math.abs(p - pagination.page) <= 1)
                    .map((page, idx, arr) => (
                      <>
                        {idx > 0 && arr[idx - 1] !== page - 1 && <span className="px-1 text-muted-foreground">...</span>}
                        <Button
                          key={page}
                          variant={pagination.page === page ? 'default' : 'outline'}
                          size="sm"
                          className="h-6 w-6 p-0 text-xs"
                          onClick={() => handlePageChange(page)}
                        >
                          {page}
                        </Button>
                      </>
                    ))}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 px-2 text-xs gap-1"
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => handlePageChange(pagination.page + 1)}
                >
                  <ChevronRight className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
