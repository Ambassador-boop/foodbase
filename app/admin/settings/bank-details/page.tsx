'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, AlertCircle, ChevronDown, Loader } from 'lucide-react';
import Link from 'next/link';

interface Bank {
  id: number;
  code: string;
  name: string;
}

interface BankDetails {
  id: string;
  bank_code: string;
  account_number: string;
  account_name: string;
  is_active: boolean;
}

export default function AdminBankDetailsPage() {
  const router = useRouter();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [existingDetails, setExistingDetails] = useState<BankDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [validating, setValidating] = useState(false);

  const [formData, setFormData] = useState({
    bankCode: '',
    accountNumber: '',
    accountName: '',
  });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [banksRes, detailsRes] = await Promise.all([
        fetch('/api/paystack/banks'),
        fetch('/api/admin/bank-details', {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('authToken')}`,
          },
        }),
      ]);

      if (banksRes.ok) {
        const data = await banksRes.json();
        setBanks(data.banks || []);
      }

      if (detailsRes.ok) {
        const data = await detailsRes.json();
        if (data) {
          setExistingDetails(data);
          setFormData({
            bankCode: data.bank_code,
            accountNumber: data.account_number,
            accountName: data.account_name,
          });
        }
      }

      setError('');
    } catch (err) {
      console.error('[v0] Error fetching data:', err);
      setError('Failed to load bank data');
    } finally {
      setLoading(false);
    }
  };

  const validateAccountNumber = async () => {
    if (!formData.accountNumber || !formData.bankCode) {
      setError('Please fill in account number and select a bank');
      return;
    }

    setValidating(true);
    setError('');

    try {
      const response = await fetch('/api/paystack/validate-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountNumber: formData.accountNumber,
          bankCode: formData.bankCode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Account validation failed');
        return;
      }

      setFormData((prev) => ({
        ...prev,
        accountName: data.account_name,
      }));
    } catch (err) {
      console.error('[v0] Validation error:', err);
      setError('Failed to validate account');
    } finally {
      setValidating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.bankCode || !formData.accountNumber || !formData.accountName) {
      setError('All fields are required. Please validate your account first.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch('/api/admin/bank-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken')}`,
        },
        body: JSON.stringify({
          bank_code: formData.bankCode,
          account_number: formData.accountNumber,
          account_name: formData.accountName,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to save bank details');
        return;
      }

      setExistingDetails(data);
      router.push('/admin/revenue/withdraw');
    } catch (err) {
      console.error('[v0] Error saving bank details:', err);
      setError('Failed to save bank details');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  const selectedBank = banks.find((b) => b.code === formData.bankCode);

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/settings">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Bank Account Details</h1>
          <p className="text-xs text-muted-foreground">
            {existingDetails ? 'Update your' : 'Set up your'} bank account for withdrawals
          </p>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}

      {/* Existing Details Info */}
      {existingDetails && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <p className="text-xs font-semibold text-primary mb-2">Current Bank Account</p>
          <div className="space-y-1 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Bank:</span>
              <span className="font-medium">{selectedBank?.name || existingDetails.bank_code}</span>
            </div>
            <div className="flex justify-between">
              <span>Account Number:</span>
              <span className="font-medium">{existingDetails.account_number}</span>
            </div>
            <div className="flex justify-between">
              <span>Account Name:</span>
              <span className="font-medium">{existingDetails.account_name}</span>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white border border-border rounded-lg p-6 space-y-4">
        {/* Bank Selection */}
        <div>
          <Label className="text-xs font-semibold">Select Bank</Label>
          <div className="relative mt-1">
            <button
              type="button"
              onClick={() => setShowBankDropdown(!showBankDropdown)}
              className="w-full h-8 px-3 text-xs border border-border rounded bg-white text-foreground hover:bg-background flex items-center justify-between"
            >
              <span>{selectedBank?.name || 'Select a bank...'}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showBankDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 border border-border rounded bg-white shadow-lg z-50 max-h-40 overflow-y-auto">
                {banks.map((bank) => (
                  <button
                    key={bank.code}
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, bankCode: bank.code }));
                      setShowBankDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-background text-foreground"
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
          <Label className="text-xs font-semibold">Account Number</Label>
          <Input
            type="text"
            value={formData.accountNumber}
            onChange={(e) => setFormData((prev) => ({ ...prev, accountNumber: e.target.value }))}
            placeholder="Enter account number"
            className="mt-1 h-8 text-xs"
          />
        </div>

        {/* Validate Button */}
        <Button
          type="button"
          onClick={validateAccountNumber}
          disabled={validating || !formData.accountNumber || !formData.bankCode}
          variant="outline"
          className="w-full h-8 text-xs"
        >
          {validating ? <Loader className="w-3 h-3 animate-spin mr-2" /> : null}
          {validating ? 'Validating...' : 'Validate Account'}
        </Button>

        {/* Account Name (readonly after validation) */}
        <div>
          <Label className="text-xs font-semibold">Account Name</Label>
          <Input
            type="text"
            value={formData.accountName}
            disabled
            className="mt-1 h-8 text-xs bg-background text-muted-foreground"
            placeholder="Will appear after validation"
          />
        </div>

        {/* Info Box */}
        <div className="bg-primary/5 border border-primary/20 rounded p-3">
          <p className="text-xs font-semibold mb-1">Validation Process:</p>
          <p className="text-xs text-muted-foreground">
            Click &quot;Validate Account&quot; to verify your bank details with Paystack. Once validated, you can save and proceed to withdrawals.
          </p>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={submitting || !formData.accountName}
          className="w-full h-8 text-xs bg-primary text-white hover:bg-primary-dark"
        >
          {submitting ? 'Saving...' : 'Save Bank Details'}
        </Button>
      </form>
    </div>
  );
}
