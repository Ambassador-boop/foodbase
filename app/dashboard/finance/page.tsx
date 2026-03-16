'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertCircle, TrendingUp, TrendingDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface Transaction {
  id: string;
  order_id: string;
  amount: number;
  type: 'inflow' | 'outflow'; // inflow for orders, outflow for withdrawals/refunds
  status: 'completed' | 'pending' | 'failed';
  created_at: string;
  description?: string;
}

interface Refund {
  id: string;
  transaction_id: string;
  order_id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  created_at: string;
  bank_account_number?: string;
}

interface Business {
  available_balance: number;
  pending_balance: number;
}

export default function FinancePage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();

    // Poll for new records every 3 seconds
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [businessRes, transactionsRes, refundsRes, withdrawalsRes] = await Promise.all([
        fetch('/api/business'),
        fetch('/api/business/transactions'),
        fetch('/api/business/refunds'),
        fetch('/api/business/withdrawals'),
      ]);

      if (businessRes.ok) {
        const data = await businessRes.json();
        setBusiness(data.business);
      }

      if (transactionsRes.ok) {
        const data = await transactionsRes.json();
        setTransactions(data || []);
      }

      if (refundsRes.ok) {
        const data = await refundsRes.json();
        setRefunds(data || []);
      }

      if (withdrawalsRes.ok) {
        const data = await withdrawalsRes.json();
        setWithdrawals(data || []);
      }

      setError('');
    } catch (err) {
      console.error('[v0] Error fetching finance data:', err);
      setError('Failed to load finance data');
    } finally {
      setLoading(false);
    }
  }, []);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  const allRecords = [
    ...transactions.map((t) => ({
      id: t.id,
      type: 'transaction' as const,
      amount: t.amount,
      direction: t.type,
      status: t.status,
      created_at: t.created_at,
      order_id: t.order_id,
      description: t.description,
    })),
    ...refunds.map((r) => ({
      id: r.id,
      type: 'refund' as const,
      amount: r.amount,
      direction: 'outflow' as const,
      status: r.status,
      created_at: r.created_at,
      order_id: r.order_id,
      description: `Refund for Order ${r.order_id.slice(0, 8)}`,
    })),
    ...withdrawals.map((w) => ({
      id: w.id,
      type: 'withdrawal' as const,
      amount: w.amount,
      direction: 'outflow' as const,
      status: w.status,
      created_at: w.created_at,
      order_id: undefined,
      description: `Withdrawal to ${w.bank_account_number || 'Bank Account'}`,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground text-sm">Loading finance data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold mb-1">Finance</h1>
        <p className="text-xs text-muted-foreground">Manage payments, refunds, and withdrawals</p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Balance Cards */}
      {business && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-white border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">Available Balance</p>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(business.available_balance)}</p>
            <p className="text-xs text-muted-foreground mt-2">Ready to withdraw</p>
          </div>
          <div className="bg-white border border-border rounded-lg p-4">
            <p className="text-xs text-muted-foreground mb-1">Pending Balance</p>
            <p className="text-3xl font-bold text-amber-600">{formatCurrency(business.pending_balance)}</p>
            <p className="text-xs text-muted-foreground mt-2">Available tomorrow</p>
          </div>
        </div>
      )}

      {/* Withdraw Funds Button */}
      <Link href="/dashboard/finance/withdraw">
        <Button className="w-full h-9 bg-primary text-white hover:bg-primary-dark text-sm font-medium">
          Withdraw Funds
        </Button>
      </Link>

      {/* Records Section */}
      <div className="bg-white border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-4">Money Flow & Transactions</h2>

        {allRecords.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No transactions yet</p>
        ) : (
          <div className="space-y-2">
            {allRecords.map((record) => (
              <Link
                key={`${record.type}-${record.id}`}
                href={
                  record.type === 'transaction'
                    ? `/dashboard/finance/transaction/${record.order_id}`
                    : record.type === 'refund'
                      ? `/dashboard/finance/transaction/${record.order_id}/refund`
                      : `/dashboard/finance/withdrawal/${record.id}`
                }
              >
                <div className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 border border-transparent hover:border-border transition-all cursor-pointer">
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`p-2 rounded-full ${
                      record.direction === 'inflow'
                        ? 'bg-green-100'
                        : 'bg-red-100'
                    }`}>
                      {record.direction === 'inflow' ? (
                        <TrendingUp className="w-4 h-4 text-green-600" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-red-600" />
                      )}
                    </div>

                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {record.type === 'transaction' && 'Order Payment'}
                        {record.type === 'refund' && 'Refund'}
                        {record.type === 'withdrawal' && 'Withdrawal'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {record.description}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(parseISO(record.created_at), 'MMM dd, yyyy hh:mm a')}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={`text-sm font-semibold ${
                      record.direction === 'inflow'
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}>
                      {record.direction === 'inflow' ? '+' : '-'}
                      {formatCurrency(record.amount)}
                    </p>
                    <span className={`text-xs font-medium px-2 py-1 rounded inline-block mt-1 ${
                      record.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : record.status === 'pending'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                    }`}>
                      {record.status}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
