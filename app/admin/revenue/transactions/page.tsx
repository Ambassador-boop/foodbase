'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, AlertCircle, Loader, ChevronLeft, ChevronRight } from 'lucide-react';

interface Transaction {
  id: string;
  order_id: string;
  service_fee_amount: number;
  service_fee_type: string;
  created_at: string;
  total_amount: number;
  customer_name: string;
  order_status: string;
  business_name: string;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

function TransactionsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pageParam = searchParams.get('page');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const page = pageParam ? parseInt(pageParam) : 1;
    fetchTransactions(page);
  }, [pageParam]);

  const fetchTransactions = async (page: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/revenue/transactions?page=${page}&limit=20`, {
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to fetch transactions');
        return;
      }

      setTransactions(data.transactions || []);
      setPagination(data.pagination);
    } catch (err) {
      console.error('[v0] Error fetching transactions:', err);
      setError('Failed to load transactions');
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
    router.push(`?page=${newPage}`);
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/revenue">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Revenue Transactions</h1>
          <p className="text-xs text-muted-foreground">Complete list of all service fee transactions</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}

      {/* Transactions Table */}
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        {transactions.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-muted-foreground text-xs">No transactions found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-background border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Restaurant</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Service Fee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Order Total</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-background">
                      <td className="px-4 py-3 text-xs font-medium">{tx.business_name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{tx.customer_name}</td>
                      <td className="px-4 py-3 text-xs font-semibold text-green-600">
                        {formatCurrency(Number(tx.service_fee_amount) || 0)}
                      </td>
                      <td className="px-4 py-3 text-xs">{formatCurrency(Number(tx.total_amount) || 0)}</td>
                      <td className="px-4 py-3 text-xs">
                        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                          tx.order_status === 'completed'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {tx.order_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(tx.created_at)}</td>
                      <td className="px-4 py-3 text-xs">
                        <Link href={`/admin/revenue/${tx.id}`}>
                          <Button variant="ghost" size="sm" className="h-6 text-xs">
                            View
                          </Button>
                        </Link>
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
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} transactions
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
                  {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={pagination.page === page ? 'default' : 'outline'}
                      size="sm"
                      className="h-6 w-6 p-0 text-xs"
                      onClick={() => handlePageChange(page)}
                    >
                      {page}
                    </Button>
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

export default function TransactionsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader className="w-6 h-6 animate-spin" /></div>}>
      <TransactionsContent />
    </Suspense>
  );
}
