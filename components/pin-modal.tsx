'use client';

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pin: string) => Promise<void>;
  purpose: 'bank_account' | 'withdrawal';
  pinId: string;
  isLoading?: boolean;
}

export function PinModal({
  isOpen,
  onClose,
  onSubmit,
  purpose,
  pinId,
  isLoading = false,
}: PinModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const title =
    purpose === 'bank_account'
      ? 'Verify Bank Account'
      : 'Authorize Withdrawal';

  const description =
    purpose === 'bank_account'
      ? 'Enter the 6-digit access PIN sent to your phone to save your bank account.'
      : 'Enter the 6-digit access PIN sent to your phone to authorize this withdrawal.';

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
      inputRefs.current[0]?.focus();
    }
  }, [isOpen]);

  const handlePinChange = (value: string) => {
    // Only allow digits
    const cleaned = value.replace(/\D/g, '').slice(0, 6);
    setPin(cleaned);
    setError('');

    // Auto-focus to next input if needed
    if (cleaned.length === 6) {
      inputRefs.current[5]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (pin.length !== 6) {
      setError('Please enter a 6-digit PIN');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(pin);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify PIN');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && pin.length === 6) {
      handleSubmit(e as any);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-medium">6-Digit Access PIN</label>
            <div className="flex gap-2 justify-center">
              {Array.from({ length: 6 }).map((_, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={pin[index] || ''}
                  onChange={(e) => handlePinChange(pin.slice(0, index) + e.target.value + pin.slice(index + 1))}
                  onKeyDown={handleKeyDown}
                  disabled={isSubmitting || isLoading}
                  className="w-12 h-12 text-center text-lg font-semibold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none"
                />
              ))}
            </div>
            {error && <p className="text-sm text-red-500 text-center">{error}</p>}
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting || isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pin.length !== 6 || isSubmitting || isLoading}
              className="flex-1"
            >
              {isSubmitting || isLoading ? 'Verifying...' : 'Verify PIN'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
