'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { AlertCircle, ArrowLeft, Loader, ChevronDown } from 'lucide-react';

interface Bank {
  id: number;
  code: string;
  name: string;
}

interface BankDetails {
  bank_code: string;
  bank_account_number: string;
  bank_account_holder: string;
}

export default function BankDetailsPage() {
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showBankDropdown, setShowBankDropdown] = useState(false);
  const [validating, setValidating] = useState(false);

  const [bankDetails, setBankDetails] = useState<BankDetails>({
    bank_code: '',
    bank_account_number: '',
    bank_account_holder: '',
  });

  const [accountValidated, setAccountValidated] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [banksRes, detailsRes] = await Promise.all([
        fetch('/api/paystack/banks'),
        fetch('/api/business/bank-details', { credentials: 'include' }),
      ]);

      if (banksRes.ok) {
        const data = await banksRes.json();
        setBanks(data.banks || []);
      }

      if (detailsRes.ok) {
        const data = await detailsRes.json();
        if (data.bank_code) {
          setBankDetails({
            bank_code: data.bank_code,
            bank_account_number: data.bank_account_number || '',
            bank_account_holder: data.bank_account_holder || '',
          });
          setAccountValidated(!!data.bank_account_holder);
        }
      }

      setError('');
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load bank data');
    } finally {
      setLoading(false);
    }
  };

  const validateAccountNumber = async () => {
    if (!bankDetails.bank_account_number || !bankDetails.bank_code) {
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
          accountNumber: bankDetails.bank_account_number,
          bankCode: bankDetails.bank_code,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Account validation failed');
        return;
      }

      setBankDetails((prev) => ({
        ...prev,
        bank_account_holder: data.account_name,
      }));

      setAccountValidated(true);
      setError('');
    } catch (err) {
      console.error('Validation error:', err);
      setError('Failed to validate account');
    } finally {
      setValidating(false);
    }
  };

  const handleSaveBankDetails = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!bankDetails.bank_code) {
      setError('Please select a bank');
      return;
    }

    if (!bankDetails.bank_account_number) {
      setError('Please enter account number');
      return;
    }

    if (!bankDetails.bank_account_holder) {
      setError('Please validate account details first');
      return;
    }

    setSaving(true);
    setError('');

    try {
      const response = await fetch('/api/business/bank-details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          bank_code: bankDetails.bank_code,
          bank_account_number: bankDetails.bank_account_number,
          bank_account_holder: bankDetails.bank_account_holder,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save bank details');
      }

      setSuccess('Bank details saved successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Save error:', err);
      setError(err instanceof Error ? err.message : 'Failed to save bank details');
    } finally {
      setSaving(false);
    }
  };

  const selectedBank = banks.find((b) => b.code === bankDetails.bank_code);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/dashboard/profile">
            <Button variant="outline" size="sm" className="h-8">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-foreground">Bank Details</h1>
        </div>
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground text-sm">Loading bank details...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2">
        <Link href="/dashboard/profile">
          <Button variant="outline" size="sm" className="h-8">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Bank Details</h1>
      </div>

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm text-green-700">{success}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSaveBankDetails} className="space-y-6">
        {/* Information Card */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-2">What are bank details?</h2>
            <p className="text-sm text-muted-foreground">
              Add your business bank account information. This is where your withdrawal funds will be transferred.
            </p>
          </div>
        </div>

        {/* Bank Selection */}
        <div className="bg-card border border-border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Bank Information</h2>

          <div>
            <label className="text-sm font-semibold block mb-2 text-foreground">Select Bank *</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowBankDropdown(!showBankDropdown)}
                className="w-full px-3 py-2.5 border border-border rounded-lg text-sm text-left flex items-center justify-between bg-background hover:bg-muted/30 transition-colors"
              >
                <span className={selectedBank?.name || 'Select a bank'}>
                  {selectedBank?.name || 'Select a bank'}
                </span>
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              </button>

              {showBankDropdown && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto z-10">
                  {banks.map((bank) => (
                    <button
                      key={bank.code}
                      type="button"
                      onClick={() => {
                        setBankDetails({ ...bankDetails, bank_code: bank.code });
                        setShowBankDropdown(false);
                        setAccountValidated(false);
                      }}
                      className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors border-b border-border last:border-0 text-foreground"
                    >
                      {bank.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold block mb-2 text-foreground">Account Number *</label>
            <input
              type="text"
              value={bankDetails.bank_account_number}
              onChange={(e) => {
                setBankDetails({ ...bankDetails, bank_account_number: e.target.value });
                setAccountValidated(false);
              }}
              placeholder="Enter your 10-digit account number"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div>
            <label className="text-sm font-semibold block mb-2 text-foreground">Account Holder Name</label>
            <input
              type="text"
              value={bankDetails.bank_account_holder}
              readOnly
              placeholder="Verified account holder name"
              className="w-full px-3 py-2.5 border border-border rounded-lg text-sm bg-muted/30 text-foreground cursor-not-allowed"
            />
            {accountValidated && (
              <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Account verified
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={validateAccountNumber}
            disabled={!bankDetails.bank_account_number || !bankDetails.bank_code || validating}
            className="w-full py-2.5 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {validating ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Verify Account Details'
            )}
          </button>
        </div>

        {/* Important Note */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <p className="text-xs text-foreground">
            <strong>Important:</strong> Make sure the account number and account holder name match your bank records. This information will be used for all future withdrawals.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Link href="/dashboard/profile" className="flex-1">
            <Button variant="outline" className="w-full h-10">
              Cancel
            </Button>
          </Link>
          <button
            type="submit"
            disabled={saving || !accountValidated}
            className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center text-sm font-medium transition-colors"
          >
            {saving ? (
              <>
                <Loader className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Bank Details'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
