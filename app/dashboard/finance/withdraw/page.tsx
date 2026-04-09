'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, Loader, ChevronDown } from 'lucide-react';

interface Business {
  available_balance: number;
  pending_balance: number;
}

interface BankDetails {
  bank_code: string;
  bank_account_number: string;
  bank_account_holder: string;
}

const SERVICE_FEE_PERCENTAGE = 0.075; // 7.5%

export default function WithdrawalPage() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [withdrawalData, setWithdrawalData] = useState({
    amount: '',
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [businessRes, bankDetailsRes] = await Promise.all([
        fetch('/api/business', { credentials: 'include' }),
        fetch('/api/business/bank-details', { credentials: 'include' }),
      ]);

      if (businessRes.ok) {
        const data = await businessRes.json();
        setBusiness(data.business);
      }

      if (bankDetailsRes.ok) {
        const data = await bankDetailsRes.json();
        if (data.bank_code && data.bank_account_number && data.bank_account_holder) {
          setBankDetails({
            bank_code: data.bank_code,
            bank_account_number: data.bank_account_number,
            bank_account_holder: data.bank_account_holder,
          });
        }
      }

      setError('');
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load withdrawal data');
    } finally {
      setLoading(false);
    }
  };



  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!withdrawalData.amount || parseFloat(withdrawalData.amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!bankDetails) {
      setError('Bank details not configured');
      return;
    }

    if (!business) {
      setError('Business data not loaded');
      return;
    }

    const withdrawAmount = parseFloat(withdrawalData.amount);

    if (withdrawAmount > business.available_balance) {
      setError('Insufficient available balance');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/business/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          amount: withdrawAmount,
          bank_code: bankDetails.bank_code,
          bank_account_number: bankDetails.bank_account_number,
          bank_account_holder: bankDetails.bank_account_holder,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to request withdrawal');
      }

      // Redirect to withdrawal details
      router.push(`/dashboard/finance/withdrawal/${data.withdrawalId}`);
    } catch (err) {
      console.error('Withdrawal error:', err);
      setError(err instanceof Error ? err.message : 'Failed to request withdrawal');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

  const withdrawAmount = parseFloat(withdrawalData.amount) || 0;
  const serviceFee = withdrawAmount * SERVICE_FEE_PERCENTAGE;
  const netAmount = withdrawAmount - serviceFee;

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
          <h1 className="text-2xl font-bold text-foreground">Withdraw Funds</h1>
        </div>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground text-sm">Loading withdrawal data...</p>
        </div>
      </div>
    );
  }

  if (!bankDetails) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/finance">
            <Button variant="outline" size="sm" className="h-8">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Withdraw Funds</h1>
        </div>

        <div className="bg-card border border-border rounded-lg p-8 text-center space-y-6 max-w-md mx-auto">
          <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6 text-primary" />
          </div>

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Bank Details Required</h2>
            <p className="text-sm text-muted-foreground">
              You need to add your bank details before you can request a withdrawal.
            </p>
          </div>

          <Link href="/dashboard/profile/bank-details" className="w-full">
            <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/90 h-10">
              Add Bank Details
            </Button>
          </Link>

          <p className="text-xs text-muted-foreground">
            We use your bank details to transfer your withdrawal funds securely.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Link href="/dashboard/finance">
          <Button variant="outline" size="sm" className="h-8">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Withdraw Funds</h1>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      )}

      {business && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-xs text-muted-foreground mb-2">Available Balance</p>
            <p className="text-3xl font-bold text-primary">{formatCurrency(business.available_balance)}</p>
            <p className="text-xs text-muted-foreground mt-2">Ready to withdraw</p>
          </div>
          <div className="bg-card border border-border rounded-lg p-6">
            <p className="text-xs text-muted-foreground mb-2">Pending Balance</p>
            <p className="text-3xl font-bold text-accent">{formatCurrency(business.pending_balance)}</p>
            <p className="text-xs text-muted-foreground mt-2">Available tomorrow</p>
          </div>
        </div>
      )}

      {/* Bank Details Summary */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold text-foreground">Withdrawal Details</h2>
          <Link href="/dashboard/profile/bank-details">
            <Button variant="outline" size="sm" className="text-xs h-8">
              Change
            </Button>
          </Link>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-sm text-muted-foreground">Account Holder</span>
            <span className="text-sm font-medium text-foreground">{bankDetails.bank_account_holder}</span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-border">
            <span className="text-sm text-muted-foreground">Account Number</span>
            <span className="text-sm font-medium text-foreground">{bankDetails.bank_account_number}</span>
          </div>
          <div className="flex items-center justify-between py-2">
            <span className="text-sm text-muted-foreground">Bank Code</span>
            <span className="text-sm font-medium text-foreground">{bankDetails.bank_code}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleWithdrawalSubmit} className="space-y-6">
        {/* Withdrawal Amount */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Withdrawal Amount</h2>

          <div>
            <label className="text-sm font-semibold block mb-2 text-foreground">Amount to Withdraw *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₦</span>
              <input
                type="number"
                step="0.01"
                max={business?.available_balance || 0}
                value={withdrawalData.amount}
                onChange={(e) => setWithdrawalData({ ...withdrawalData, amount: e.target.value })}
                className="w-full pl-8 pr-3 py-2.5 border border-border rounded-lg text-sm bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Max available: {formatCurrency(business?.available_balance || 0)}
            </p>
          </div>

          {withdrawAmount > 0 && (
            <div className="bg-muted/30 rounded-lg p-4 space-y-3 border border-border">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Gross Amount</p>
                <p className="text-sm font-medium text-foreground">{formatCurrency(withdrawAmount)}</p>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Service Fee (7.5%)</p>
                <p className="text-sm font-medium text-destructive">-{formatCurrency(serviceFee)}</p>
              </div>

              <div className="pt-3 border-t border-border flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">Net Amount to Receive</p>
                <p className="text-lg font-bold text-primary">{formatCurrency(netAmount)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Important Note */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <p className="text-xs text-foreground">
            <strong>Note:</strong> A service fee of 7.5% is deducted from your withdrawal amount. The net amount will be transferred to your bank account within 1-2 business days.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link href="/dashboard/finance" className="flex-1">
            <Button variant="outline" className="w-full h-10">
              Cancel
            </Button>
          </Link>
          <button
            type="submit"
            disabled={submitting || !withdrawalData.amount}
            className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium transition-colors"
          >
            {submitting ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              'Request Withdrawal'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
