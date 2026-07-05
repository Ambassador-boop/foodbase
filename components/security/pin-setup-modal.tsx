'use client';

import { useState, useRef, useEffect } from 'react';
import { AlertCircle, CheckCircle, Lock, ArrowRight } from 'lucide-react';

interface PinSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSetupComplete: (pin: string) => void;
}

export function PinSetupModal({ isOpen, onClose, onSetupComplete }: PinSetupModalProps) {
  const [step, setStep] = useState<'intro' | 'pin-input' | 'loading'>('intro');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const pinInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 'pin-input' && pinInputRef.current) {
      pinInputRef.current.focus();
    }
  }, [step]);

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setPin(value);
    setError('');
  };

  const handleConfirmPinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setConfirmPin(value);
    setError('');
  };

  const validatePin = () => {
    if (pin.length < 4) {
      setError('PIN must be at least 4 digits');
      return false;
    }
    if (pin.length > 6) {
      setError('PIN must not exceed 6 digits');
      return false;
    }
    if (pin !== confirmPin) {
      setError('PINs do not match');
      return false;
    }
    return true;
  };

  const handleNext = () => {
    if (step === 'intro') {
      setStep('pin-input');
    } else if (step === 'pin-input') {
      if (validatePin()) {
        setStep('loading');
        handleSetupPin();
      }
    }
  };

  const handleSetupPin = async () => {
    setIsLoading(true);
    try {
      // First request OTP for PIN setup
      const setupResponse = await fetch('/api/user/pin/request-setup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!setupResponse.ok) {
        throw new Error('Failed to initiate PIN setup');
      }

      const setupData = await setupResponse.json();
      
      // Navigate to security page to complete verification
      onSetupComplete(pin);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to setup PIN');
      setStep('pin-input');
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        {step === 'intro' && (
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100">
              <Lock className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Set Up PIN</h2>
            <p className="text-gray-600 text-sm">
              A PIN provides additional security for sensitive actions like updating bank details and making withdrawals.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-left text-sm text-gray-700">
              <p className="font-medium mb-2">PIN Requirements:</p>
              <ul className="space-y-1 text-xs">
                <li>• 4-6 digits</li>
                <li>• Must be confirmed</li>
                <li>• Securely stored and hashed</li>
              </ul>
            </div>
          </div>
        )}

        {step === 'pin-input' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">Enter Your PIN</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                PIN (4-6 digits)
              </label>
              <input
                ref={pinInputRef}
                type="password"
                inputMode="numeric"
                placeholder="••••"
                value={pin}
                onChange={handlePinChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center tracking-widest text-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Confirm PIN
              </label>
              <input
                type="password"
                inputMode="numeric"
                placeholder="••••"
                value={confirmPin}
                onChange={handleConfirmPinChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center tracking-widest text-lg"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <p className="text-xs text-gray-500">
              Progress: {pin.length}/4 minimum digits
            </p>
          </div>
        )}

        {step === 'loading' && (
          <div className="text-center space-y-4">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 animate-pulse">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-gray-600">Setting up your PIN...</p>
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleNext}
            disabled={
              isLoading ||
              (step === 'pin-input' && (pin.length < 4 || confirmPin.length === 0))
            }
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {step === 'intro' ? (
              <>
                Let&apos;s Go <ArrowRight className="w-4 h-4" />
              </>
            ) : step === 'pin-input' ? (
              <>
                Continue <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              'Setting up...'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
