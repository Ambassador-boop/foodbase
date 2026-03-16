'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, Loader, ChevronDown } from 'lucide-react';

interface Bank {
  id: number;
  code: string;
  name: string;
}

interface Business {
  available_balance: number;
  pending_balance: number;
}

const SERVICE_FEE_PERCENTAGE = 0.075; // 7.5%

export default function WithdrawalPage() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showBankDropdown, setShowBankDropdown] = useState(false);

  const [withdrawalData, setWithdrawalData] = useState({
    amount: '',
    selectedBank: '',
    accountNumber: '',
    accountName: '',
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [businessRes, banksRes] = await Promise.all([
        fetch('/api/business'),
        fetch('/api/paystack/banks'),
      ]);

      if (businessRes.ok) {
        const data = await businessRes.json();
        setBusiness(data.business);
      }

      if (banksRes.ok) {
        const data = await banksRes.json();
        setBanks(data.banks || []);
      }

      setError('');
    } catch (err) {
      console.error('[v0] Error fetching data:', err);
      setError('Failed to load withdrawal data');
    } finally {
      setLoading(false);
    }
  };

  const validateAccountNumber = async () => {
    if (!withdrawalData.accountNumber || !withdrawalData.selectedBank) {
      setError('Please fill in account number and select a bank');
      return;
    }

    try {
      const response = await fetch('/api/paystack/validate-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountNumber: withdrawalData.accountNumber,
          bankCode: withdrawalData.selectedBank,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Account validation failed');
        return;
      }

      setWithdrawalData((prev) => ({
        ...prev,
        accountName: data.account_name,
      }));

      setError('');
    } catch (err) {
      console.error('[v0] Validation error:', err);
      setError('Failed to validate account');
    }
  };

  const handleWithdrawalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!withdrawalData.amount || parseFloat(withdrawalData.amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (!withdrawalData.selectedBank) {
      setError('Please select a bank');
      return;
    }

    if (!withdrawalData.accountNumber) {
      setError('Please enter account number');
      return;
    }

    if (!withdrawalData.accountName) {
      setError('Please validate account details first');
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
      const response = await fetch('/api/withdrawals/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: withdrawAmount,
          bankCode: withdrawalData.selectedBank,
          accountNumber: withdrawalData.accountNumber,
          accountName: withdrawalData.accountName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to request withdrawal');
      }

      // Redirect to withdrawal details
      router.push(`/dashboard/finance/withdrawal/${data.withdrawalId}`);
    } catch (err) {
      console.error('[v0] Withdrawal error:', err);
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

  const selectedBank = banks.find((b) => b.code === withdrawalData.selectedBank);

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
          <h1 className="text-2xl font-bold">Withdraw Funds</h1>
        </div>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground text-sm">Loading withdrawal data...</p>
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
        <h1 className="text-2xl font-bold">Withdraw Funds</h1>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

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

      <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
        {/* Withdrawal Amount */}
        <div className="bg-white border border-border rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-semibold">Withdrawal Amount</h2>

          <div>
            <label className="text-xs font-semibold block mb-2">Amount to Withdraw *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₦</span>
              <input
                type="number"
                step="0.01"
                max={business?.available_balance || 0}
                value={withdrawalData.amount}
                onChange={(e) => setWithdrawalData({ ...withdrawalData, amount: e.target.value })}
                className="w-full pl-8 pr-3 py-2 border border-input rounded text-sm"
                placeholder="0.00"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Max available: {formatCurrency(business?.available_balance || 0)}
            </p>
          </div>

          {withdrawAmount > 0 && (
            <div className="bg-gray-50 rounded p-3 space-y-2 border border-border">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Gross Amount</p>
                <p className="text-sm font-medium">{formatCurrency(withdrawAmount)}</p>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">Service Fee (7.5%)</p>
                <p className="text-sm font-medium text-red-600">-{formatCurrency(serviceFee)}</p>
              </div>

              <div className="pt-2 border-t border-border flex items-center justify-between">
                <p className="text-xs font-semibold">Net Amount to Receive</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(netAmount)}</p>
              </div>
            </div>
          )}
        </div>

        {/* Bank Details */}
        <div className="bg-white border border-border rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-semibold">Bank Details</h2>

          {/* Bank Selection */}
          <div>
            <label className="text-xs font-semibold block mb-2">Select Bank *</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowBankDropdown(!showBankDropdown)}
                className="w-full px-3 py-2 border border-input rounded text-sm text-left flex items-center justify-between bg-white"
              >
                <span className={selectedBank?.name || 'Select bank'}>
                  {selectedBank?.name || 'Select bank'}
                </span>
                <ChevronDown className="w-4 h-4" />
              </button>

              {showBankDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-input rounded shadow-lg max-h-64 overflow-y-auto z-10">
                  {banks.map((bank) => (
                    <button
                      key={bank.code}
                      type="button"
                      onClick={() => {
                        setWithdrawalData({ ...withdrawalData, selectedBank: bank.code });
                        setShowBankDropdown(false);
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 border-b border-border last:border-0"
                    >
                      {bank.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Account Number */}
          <div>
            <label className="text-xs font-semibold block mb-2">Account Number *</label>
            <input
              type="text"
              value={withdrawalData.accountNumber}
              onChange={(e) => setWithdrawalData({ ...withdrawalData, accountNumber: e.target.value })}
              placeholder="0123456789"
              className="w-full px-3 py-2 border border-input rounded text-sm"
            />
          </div>

          {/* Account Name (Read-only after validation) */}
          <div>
            <label className="text-xs font-semibold block mb-2">Account Name</label>
            <input
              type="text"
              value={withdrawalData.accountName}
              readOnly
              placeholder="Verified account holder name"
              className="w-full px-3 py-2 border border-input rounded text-sm bg-gray-50 cursor-not-allowed"
            />
          </div>

          {/* Validate Button */}
          <button
            type="button"
            onClick={validateAccountNumber}
            disabled={!withdrawalData.accountNumber || !withdrawalData.selectedBank}
            className="w-full py-2 border border-input rounded text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Verify Account Details
          </button>
        </div>

        {/* Important Note */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-800">
            <strong>Note:</strong> Service fee of 7.5% is deducted from your withdrawal amount. The net amount will be transferred to your bank account within 1-2 business days.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Link href="/dashboard/finance" className="flex-1">
            <Button variant="outline" className="w-full h-9">
              Cancel
            </Button>
          </Link>
          <button
            type="submit"
            disabled={submitting || !withdrawalData.accountName}
            className="flex-1 h-9 bg-primary text-white rounded hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium"
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
