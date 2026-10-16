'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, AlertCircle, Loader } from 'lucide-react';
import { usePinAuthorization } from '@/hooks/use-pin-authorization';

interface BankDetails {
  id: string;
  bank_code: string;
  account_number: string;
  account_name: string;
  is_active: boolean;
}

interface RevenueData {
  total_revenue: number;
  withdrawn_amount: number;
  available_balance: number;
}

export default function AdminWithdrawalPage() {
  const router = useRouter();
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [success, setSuccess] = useState('');
  const [recent, setRecent] = useState<any[]>([]);
  const { authorize, dialogs } = usePinAuthorization();

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [bankRes, revenueRes, withdrawalsRes] = await Promise.all([
        fetch('/api/admin/bank-details', {
          credentials: 'include',
        }),
        fetch('/api/admin/revenue', {
          credentials: 'include',
        }),
        fetch('/api/admin/withdrawals', { credentials: 'include' }),
      ]);

      if (bankRes.ok) {
        const data = await bankRes.json();
        setBankDetails(data);
      }

      if (revenueRes.ok) {
        const data = await revenueRes.json();
        setRevenue(data.summary);
      }
      if (withdrawalsRes.ok) setRecent((await withdrawalsRes.json()).slice(0, 10));

      setError('');
    } catch (err) {
      console.error('[v0] Error fetching data:', err);
      setError('Failed to load withdrawal data');
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bankDetails) {
      setError('Bank details not found. Please set up your bank account first.');
      return;
    }

    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      setError('Please enter a valid withdrawal amount');
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (!revenue || amount > revenue.available_balance) {
      setError('Insufficient available balance');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const authorizationTicket = await authorize('admin_withdrawal', { amount });
      const response = await fetch('/api/admin/withdrawals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          amount,
          authorizationTicket,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to process withdrawal');
        return;
      }

      setSuccess('Withdrawal request created successfully. Your funds will be transferred shortly.');
      setWithdrawAmount('');
      fetchInitialData();
    } catch (err) {
      console.error('[v0] Error processing withdrawal:', err);
      setError('Failed to process withdrawal');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/revenue">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Withdraw Revenue</h1>
          <p className="text-xs text-muted-foreground">Request a withdrawal of your platform revenue</p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}

      {/* No Bank Details Alert */}
      {!bankDetails && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-yellow-900 mb-3">Bank Account Not Set Up</p>
          <p className="text-xs text-yellow-800 mb-4">
            You need to add your bank account details before you can withdraw revenue.
          </p>
          <Link href="/admin/settings/bank-details">
            <Button size="sm" className="h-8 text-xs bg-primary text-white hover:bg-primary-dark">
              Add Bank Account
            </Button>
          </Link>
        </div>
      )}

      {bankDetails && revenue && (
        <>
          {/* Balance Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-border rounded-lg p-4">
              <p className="text-xs font-semibold text-muted-foreground">Total Revenue</p>
              <p className="text-lg font-bold mt-2">{formatCurrency(revenue.total_revenue)}</p>
            </div>

            <div className="bg-white border border-border rounded-lg p-4">
              <p className="text-xs font-semibold text-muted-foreground">Withdrawn</p>
              <p className="text-lg font-bold mt-2 text-primary">{formatCurrency(revenue.withdrawn_amount)}</p>
            </div>

            <div className="bg-white border border-border rounded-lg p-4">
              <p className="text-xs font-semibold text-muted-foreground">Available to Withdraw</p>
              <p className="text-lg font-bold mt-2 text-accent">{formatCurrency(revenue.available_balance)}</p>
            </div>
          </div>

          {/* Bank Details Display */}
          <div className="bg-white border border-border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold">Bank Account Details</h2>

            <div className="space-y-3">
              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-xs text-muted-foreground">Account Holder</span>
                <span className="text-xs font-semibold">{bankDetails.account_name}</span>
              </div>

              <div className="flex justify-between items-center py-2 border-b border-border">
                <span className="text-xs text-muted-foreground">Account Number</span>
                <span className="text-xs font-semibold">{bankDetails.account_number}</span>
              </div>

              <div className="flex justify-between items-center py-2">
                <span className="text-xs text-muted-foreground">Bank Code</span>
                <span className="text-xs font-semibold">{bankDetails.bank_code}</span>
              </div>
            </div>

            <Link href="/admin/settings/bank-details">
              <Button variant="outline" size="sm" className="w-full h-8 text-xs mt-4">
                Update Bank Details
              </Button>
            </Link>
          </div>

          {/* Withdrawal Form */}
          <form onSubmit={handleWithdrawal} className="bg-white border border-border rounded-lg p-6 space-y-4">
            <h2 className="font-semibold">Request Withdrawal</h2>

            <div>
              <Label className="text-xs font-semibold">Withdrawal Amount (₦)</Label>
              <Input
                type="number"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                placeholder="Enter amount to withdraw"
                max={revenue?.available_balance}
                step="100"
                className="mt-1 h-8 text-xs"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Maximum available: {formatCurrency(revenue.available_balance)}
              </p>
            </div>

            {/* Quick Amount Buttons */}
            <div className="flex gap-2">
              {[10000, 25000, 50000].map((amount) => (
                (amount <= revenue.available_balance) && (
                  <Button
                    key={amount}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-1 h-8 text-xs"
                    onClick={() => setWithdrawAmount(amount.toString())}
                  >
                    {formatCurrency(amount)}
                  </Button>
                )
              ))}
            </div>

            {/* Info Box */}
            <div className="bg-primary/5 border border-primary/20 rounded p-3 space-y-2">
              <p className="text-xs font-semibold">Processing Information:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li>Withdrawals are processed through Paystack</li>
                <li>Transfers usually arrive within a few minutes. Track the status in the withdrawal history below.</li>
                <li>You will receive a notification once processed</li>
              </ul>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={submitting || revenue.available_balance <= 0}
              className="w-full h-8 text-xs bg-primary text-white hover:bg-primary-dark"
            >
              {submitting ? 'Processing...' : 'Request Withdrawal'}
            </Button>
            </form>
            {success && <p className="text-sm text-green-700 mt-3">{success}</p>}
            <div className="mt-6">
              <h3 className="text-sm font-semibold mb-2">Recent payouts</h3>
              <div className="flex flex-col gap-2">
                {recent.map((item) => <div key={`${item.source}-${item.id}`} className="flex items-center justify-between text-xs border rounded p-2"><span>{formatCurrency(Number(item.amount))}</span><span className="capitalize">{item.status}</span><span>{new Date(item.created_at).toLocaleDateString()}</span></div>)}
              </div>
            </div>
          </>
      )}
    </div>
    {dialogs} 
  );
}
