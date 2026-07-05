'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle, Clock, Lock, ArrowLeft } from 'lucide-react';

interface OTPStep {
  otpId: string;
  expiresAt: Date;
}

export default function PinSetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<'pin-input' | 'otp-verify' | 'success' | 'error'>('pin-input');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [otp, setOtp] = useState('');
  const [otpStep, setOtpStep] = useState<OTPStep | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes

  // Handle OTP countdown timer
  useEffect(() => {
    if (step !== 'otp-verify' || timeLeft <= 0) return;
    
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setError('OTP has expired. Please request a new one.');
          setStep('pin-input');
          return 600;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [step, timeLeft]);

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

  const handleRequestOTP = async () => {
    if (!validatePin()) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/user/pin/request-setup', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to request OTP');
      }

      const data = await response.json();
      setOtpStep({
        otpId: data.otpId,
        expiresAt: new Date(data.expiresAt),
      });
      setStep('otp-verify');
      setTimeLeft(600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to request OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (!otp || !otpStep) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/user/pin/verify-and-save', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          otpId: otpStep.otpId,
          otp,
          pin,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to verify OTP');
      }

      setStep('success');
      setTimeout(() => {
        router.push('/dashboard/security');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to verify OTP');
    } finally {
      setIsLoading(false);
    }
  };

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

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
    setOtp(value);
    setError('');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Security Settings
        </button>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-lg p-8">
          {step === 'pin-input' && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100">
                  <Lock className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Set Up Your PIN</h1>
                  <p className="text-gray-600 mt-1">
                    4-6 digit code for sensitive transactions
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-700">
                  <strong>Your PIN will be:</strong>
                </p>
                <ul className="mt-2 space-y-1 text-sm text-gray-600">
                  <li>✓ Required when updating bank details</li>
                  <li>✓ Required for withdrawal requests</li>
                  <li>✓ Securely hashed and stored</li>
                  <li>✓ Only used when PIN auth mode is selected</li>
                </ul>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter PIN (4-6 digits)
                  </label>
                  <input
                    type="password"
                    inputMode="numeric"
                    placeholder="••••"
                    value={pin}
                    onChange={handlePinChange}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center tracking-widest text-2xl"
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center tracking-widest text-2xl"
                  />
                </div>

                <p className="text-xs text-gray-500">
                  Progress: {pin.length}/4 minimum digits required
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                onClick={handleRequestOTP}
                disabled={
                  isLoading || pin.length < 4 || confirmPin.length === 0
                }
                className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? 'Sending OTP...' : 'Send Verification Code'}
              </button>
            </>
          )}

          {step === 'otp-verify' && (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Verify OTP</h1>
                  <p className="text-gray-600 mt-1">
                    Check your email for the verification code
                  </p>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
                <p className="text-sm text-gray-700">
                  We&apos;ve sent a 6-digit code to your email. Enter it below to complete PIN setup.
                </p>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Enter Verification Code
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="000000"
                    value={otp}
                    onChange={handleOtpChange}
                    maxLength={6}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center tracking-widest text-2xl"
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Time remaining:</span>
                  <span
                    className={`font-mono font-bold ${
                      timeLeft < 120 ? 'text-red-600' : 'text-gray-900'
                    }`}
                  >
                    {formatTime(timeLeft)}
                  </span>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setStep('pin-input');
                    setOtp('');
                    setError('');
                  }}
                  disabled={isLoading}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleVerifyOTP}
                  disabled={isLoading || otp.length !== 6}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? 'Verifying...' : 'Verify & Save PIN'}
                </button>
              </div>
            </>
          )}

          {step === 'success' && (
            <>
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">PIN Set Successfully!</h1>
                <p className="text-gray-600">
                  Your PIN is now active and will be required for sensitive transactions.
                </p>
                <p className="text-sm text-gray-500 mt-4">
                  Redirecting to security settings...
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
