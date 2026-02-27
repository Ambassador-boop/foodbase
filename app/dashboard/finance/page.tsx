'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface Business {
  available_balance: number;
  pending_balance: number;
}

export default function FinancePage() {
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankData, setBankData] = useState({
    accountHolder: '',
    accountNumber: '',
    bankCode: '',
  });

  useEffect(() => {
    fetchBusiness();
  }, []);

  const fetchBusiness = async () => {
    try {
      const response = await fetch('/api/business');
      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setBusiness(data.business);
    } catch (err) {
      setError('Failed to load finance data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestWithdrawal = async () => {
    if (!bankData.accountHolder || !bankData.accountNumber || !bankData.bankCode) {
      setError('All bank details are required');
      return;
    }

    try {
      // API call for withdrawal request would go here
      alert('Withdrawal request submitted');
      setShowBankForm(false);
    } catch (err) {
      setError('Failed to submit withdrawal request');
    }
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

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
        <p className="text-xs text-muted-foreground">Manage payments and withdrawals</p>
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

      {/* Withdrawal Form */}
      {!showBankForm ? (
        <Button
          onClick={() => setShowBankForm(true)}
          className="w-full h-9 bg-primary text-white hover:bg-primary-dark text-sm font-medium"
        >
          Request Withdrawal
        </Button>
      ) : (
        <div className="bg-white border border-border rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-semibold">Withdrawal Details</h2>

          <div>
            <label className="text-xs font-semibold block mb-1">Account Holder Name</label>
            <input
              type="text"
              placeholder="John Doe"
              value={bankData.accountHolder}
              onChange={(e) => setBankData({ ...bankData, accountHolder: e.target.value })}
              className="w-full h-8 text-xs border border-input rounded px-2 py-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">Account Number</label>
            <input
              type="text"
              placeholder="0123456789"
              value={bankData.accountNumber}
              onChange={(e) => setBankData({ ...bankData, accountNumber: e.target.value })}
              className="w-full h-8 text-xs border border-input rounded px-2 py-1"
            />
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1">Bank Code</label>
            <input
              type="text"
              placeholder="999"
              value={bankData.bankCode}
              onChange={(e) => setBankData({ ...bankData, bankCode: e.target.value })}
              className="w-full h-8 text-xs border border-input rounded px-2 py-1"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => setShowBankForm(false)}
              variant="outline"
              className="flex-1 h-8 text-xs"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRequestWithdrawal}
              className="flex-1 h-8 bg-primary text-white hover:bg-primary-dark text-xs"
            >
              Submit Request
            </Button>
          </div>
        </div>
      )}

      {/* Withdrawal History */}
      <div className="bg-white border border-border rounded-lg p-4">
        <h2 className="text-sm font-semibold mb-3">Withdrawal History</h2>
        <p className="text-xs text-muted-foreground text-center py-8">No withdrawals yet</p>
      </div>
    </div>
  );
}
