'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PinModal } from '@/components/pin-modal';
import { usePinVerification } from '@/hooks/use-pin-verification';
import { useToast } from '@/hooks/use-toast';

interface WithdrawalWithPinProps {
  availableBalance: number;
  onSuccess?: () => void;
}

/**
 * Example component showing how to integrate PIN verification with withdrawal request.
 * This demonstrates the withdrawal authorization flow with KudiSMS PIN verification.
 */
export function WithdrawalWithPin({ availableBalance, onSuccess }: WithdrawalWithPinProps) {
  const [amount, setAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withdrawalId, setWithdrawalId] = useState<string | null>(null);
  const pinVerification = usePinVerification();
  const { toast } = useToast();

  const handleWithdrawal = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const withdrawalAmount = parseFloat(amount);

      // Validate amount
      if (!amount || withdrawalAmount <= 0) {
        setError('Please enter a valid amount');
        setIsSubmitting(false);
        return;
      }

      if (withdrawalAmount > availableBalance) {
        setError(`Amount exceeds available balance of ₦${availableBalance.toLocaleString()}`);
        setIsSubmitting(false);
        return;
      }

      // First, create withdrawal request
      // (Assuming you have an endpoint that creates the withdrawal record)
      const withdrawalResponse = await fetch('/api/business/withdrawals/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: withdrawalAmount,
        }),
      });

      if (!withdrawalResponse.ok) {
        const data = await withdrawalResponse.json();
        throw new Error(data.error || 'Failed to create withdrawal request');
      }

      const withdrawal = await withdrawalResponse.json();
      setWithdrawalId(withdrawal.id);

      // Then request PIN for authorization
      await pinVerification.requestPin('withdrawal', {
        withdrawal_id: withdrawal.id,
        amount: withdrawalAmount,
      });

      toast({
        title: 'PIN Sent',
        description: 'Check your phone for the 6-digit access PIN to authorize withdrawal',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to request withdrawal';
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
      // Backend will approve withdrawal and process it
      const result = await pinVerification.verifyPin(pin);

      toast({
        title: 'Success',
        description: 'Your withdrawal has been authorized! Processing will begin shortly.',
      });

      // Reset form
      setAmount('');
      setWithdrawalId(null);

      // Call callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to verify PIN';
      toast({
        title: 'Authorization Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  };

  return (
    <>
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-2xl font-bold mb-2">Request Withdrawal</h2>
          <p className="text-gray-600">
            Withdraw your available balance to your linked bank account.
          </p>
        </div>

        <div className="p-4 bg-gray-50 rounded-lg border">
          <div className="flex justify-between items-center">
            <span className="text-gray-700">Available Balance</span>
            <span className="text-2xl font-bold">
              ₦{availableBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <form onSubmit={handleWithdrawal} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Withdrawal Amount</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-500">₦</span>
              <Input
                type="number"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError(null);
                }}
                placeholder="0.00"
                disabled={isSubmitting || pinVerification.isLoading}
                className="pl-8"
                step="0.01"
                min="0"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-700">
              <strong>Note:</strong> You'll need to verify this withdrawal with a 6-digit access PIN sent to your phone.
            </p>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || pinVerification.isLoading || !amount}
            className="w-full"
          >
            {isSubmitting || pinVerification.isLoading ? 'Processing...' : 'Request Withdrawal'}
          </Button>
        </form>

        <div className="space-y-2 text-sm text-gray-600">
          <h3 className="font-medium text-gray-900">How it works:</h3>
          <ol className="list-decimal list-inside space-y-1">
            <li>Enter the amount you want to withdraw</li>
            <li>Click "Request Withdrawal"</li>
            <li>A 6-digit access PIN will be sent to your phone</li>
            <li>Enter the PIN to authorize the withdrawal</li>
            <li>Your withdrawal will be processed to your bank account</li>
          </ol>
        </div>
      </div>

      {/* PIN Verification Modal */}
      <PinModal
        isOpen={pinVerification.isOpen}
        pinId={pinVerification.pinId || ''}
        purpose="withdrawal"
        onClose={pinVerification.closeModal}
        onSubmit={handleVerifyPin}
        isLoading={pinVerification.isLoading}
      />
    </>
  );
}
