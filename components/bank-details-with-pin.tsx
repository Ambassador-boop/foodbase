'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PinModal } from '@/components/pin-modal';
import { usePinVerification } from '@/hooks/use-pin-verification';
import { useToast } from '@/hooks/use-toast';

interface BankDetailsFormData {
  bank_code: string;
  bank_account_number: string;
  bank_account_holder: string;
}

interface BankDetailsWithPinProps {
  initialData?: BankDetailsFormData;
  onSuccess?: () => void;
}

/**
 * Example component showing how to integrate PIN verification with bank details form.
 * This demonstrates the bank account saving flow with KudiSMS PIN verification.
 */
export function BankDetailsWithPin({ initialData, onSuccess }: BankDetailsWithPinProps) {
  const [formData, setFormData] = useState<BankDetailsFormData>(
    initialData || {
      bank_code: '',
      bank_account_number: '',
      bank_account_holder: '',
    }
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pinVerification = usePinVerification();
  const { toast } = useToast();

  const handleInputChange = (field: keyof BankDetailsFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setError(null);
  };

  const handleSaveBank = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate form
      if (!formData.bank_code || !formData.bank_account_number || !formData.bank_account_holder) {
        setError('Please fill in all fields');
        setIsSubmitting(false);
        return;
      }

      // Request PIN from backend
      // The backend will send SMS with PIN to the business phone number
      await pinVerification.requestPin('bank_account', {
        bank_code: formData.bank_code,
        bank_account_number: formData.bank_account_number,
        bank_account_holder: formData.bank_account_holder,
      });

      toast({
        title: 'PIN Sent',
        description: 'Check your phone for the 6-digit access PIN',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request PIN';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyPin = async (pin: string) => {
    try {
      // Verify PIN with backend
      // Backend will save bank details and delete the PIN
      const result = await pinVerification.verifyPin(pin);

      toast({
        title: 'Success',
        description: 'Your bank account has been saved successfully!',
      });

      // Reset form
      setFormData({
        bank_code: '',
        bank_account_number: '',
        bank_account_holder: '',
      });

      // Call callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      // Error is handled by the modal and shown to user
      const errorMessage = err instanceof Error ? err.message : 'Failed to verify PIN';
      toast({
        title: 'Verification Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-2xl font-bold mb-2">Bank Account Details</h2>
          <p className="text-gray-600">
            Save your bank account for withdrawals. Your details are protected and only used for transfers.
          </p>
        </div>

        <form onSubmit={handleSaveBank} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Bank Code</label>
            <Input
              value={formData.bank_code}
              onChange={(e) => handleInputChange('bank_code', e.target.value)}
              placeholder="e.g., 007 for GTB"
              disabled={isSubmitting || pinVerification.isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Account Number</label>
            <Input
              value={formData.bank_account_number}
              onChange={(e) => handleInputChange('bank_account_number', e.target.value)}
              placeholder="10-digit account number"
              disabled={isSubmitting || pinVerification.isLoading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Account Holder Name</label>
            <Input
              value={formData.bank_account_holder}
              onChange={(e) => handleInputChange('bank_account_holder', e.target.value)}
              placeholder="Name on the bank account"
              disabled={isSubmitting || pinVerification.isLoading}
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting || pinVerification.isLoading}
            className="w-full"
          >
            {isSubmitting || pinVerification.isLoading ? 'Processing...' : 'Save Bank Account'}
          </Button>
        </form>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-sm text-blue-700">
            <strong>Security:</strong> A 6-digit access PIN will be sent to your phone. You'll need to enter it to confirm your bank account details.
          </p>
        </div>
      </div>

      {/* PIN Verification Modal */}
      <PinModal
        isOpen={pinVerification.isOpen}
        pinId={pinVerification.pinId || ''}
        purpose="bank_account"
        onClose={pinVerification.closeModal}
        onSubmit={handleVerifyPin}
        isLoading={pinVerification.isLoading}
      />
    </>
  );
}
