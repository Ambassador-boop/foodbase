'use client';

import { useState } from 'react';
import { Lock, Loader2, AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PINManagementProps {
  hasPinSet: boolean;
  onPinStatusChange: (isPinSet: boolean) => void;
}

type Step = 'status' | 'setup' | 'otp-setup' | 'remove' | 'otp-remove';

interface SetupState {
  otpId: string;
}

export default function PINManagementSection({
  hasPinSet,
  onPinStatusChange,
}: PINManagementProps) {
  const [step, setStep] = useState<Step>('status');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [otp, setOtp] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [setupState, setSetupState] = useState<SetupState | null>(null);
  const [removePinInput, setRemovePinInput] = useState('');
  const [showRemovePin, setShowRemovePin] = useState(false);

  const handleInitiatePinSetup = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/user/pin/request-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to request PIN setup');
        setLoading(false);
        return;
      }

      setSetupState({ otpId: data.otpId });
      setStep('otp-setup');
    } catch (err) {
      setError('Failed to request PIN setup');
      console.error('[v0] PIN setup error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!pin || !confirmPin || !otp) {
      setError('All fields are required');
      return;
    }

    if (pin !== confirmPin) {
      setError('PINs do not match');
      return;
    }

    if (!/^\d{4,6}$/.test(pin)) {
      setError('PIN must be 4-6 digits');
      return;
    }

    if (!setupState) {
      setError('Invalid request state');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/user/pin/verify-and-save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          otpId: setupState.otpId,
          otp,
          pin,
          confirmPin,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to set PIN');
        setLoading(false);
        return;
      }

      setSuccess('PIN set successfully!');
      onPinStatusChange(true);
      setPin('');
      setConfirmPin('');
      setOtp('');
      setSetupState(null);
      setStep('status');
    } catch (err) {
      setError('Failed to set PIN');
      console.error('[v0] PIN save error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateRemovePin = () => {
    setStep('remove');
    setError(null);
    setSuccess(null);
  };

  const handleRemovePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!removePinInput) {
      setError('PIN is required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/user/pin/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin: removePinInput }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to remove PIN');
        setLoading(false);
        return;
      }

      setSuccess('PIN removed successfully!');
      onPinStatusChange(false);
      setRemovePinInput('');
      setStep('status');
    } catch (err) {
      setError('Failed to remove PIN');
      console.error('[v0] PIN remove error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 rounded-lg border border-border bg-white">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="font-semibold text-foreground">PIN Management</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Set up a personal PIN for additional security
          </p>
        </div>
        {hasPinSet && (
          <span className="px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-medium">
            PIN Set
          </span>
        )}
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4 mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 mt-4 border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}

      <div className="mt-6">
        {step === 'status' && (
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="flex items-start gap-3">
                <Lock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">
                    {hasPinSet ? 'PIN is Active' : 'No PIN Set'}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {hasPinSet
                      ? 'Your PIN is used to verify sensitive actions'
                      : 'Set up a PIN to use it for verifying sensitive actions'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              {!hasPinSet ? (
                <Button
                  onClick={handleInitiatePinSetup}
                  disabled={loading}
                  className="w-full"
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Set PIN
                </Button>
              ) : (
                <>
                  <Button
                    onClick={handleInitiateRemovePin}
                    disabled={loading}
                    variant="outline"
                    className="w-full"
                  >
                    Remove PIN
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {step === 'otp-setup' && (
          <form onSubmit={handleVerifyAndSavePin} className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground">
                A verification code has been sent to your email
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Verification Code
              </label>
              <Input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="Enter 6-digit code"
                disabled={loading}
                maxLength={6}
                className="text-center tracking-widest text-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                New PIN (4-6 digits)
              </label>
              <div className="relative">
                <Input
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter PIN"
                  disabled={loading}
                  inputMode="numeric"
                  maxLength={6}
                  className="pr-10 text-center tracking-widest text-lg font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Confirm PIN
              </label>
              <div className="relative">
                <Input
                  type={showConfirmPin ? 'text' : 'password'}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Confirm PIN"
                  disabled={loading}
                  inputMode="numeric"
                  maxLength={6}
                  className="pr-10 text-center tracking-widest text-lg font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPin(!showConfirmPin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showConfirmPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep('status');
                  setPin('');
                  setConfirmPin('');
                  setOtp('');
                  setSetupState(null);
                }}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {loading ? 'Setting PIN...' : 'Set PIN'}
              </Button>
            </div>
          </form>
        )}

        {step === 'remove' && (
          <form onSubmit={handleRemovePin} className="space-y-4">
            <div className="p-4 rounded-lg bg-red-50 border border-red-200">
              <p className="text-sm text-red-700">
                <strong>Warning:</strong> Removing your PIN will disable PIN-based verification. You&apos;ll need to use email or SMS OTP instead.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Enter PIN to Confirm Removal
              </label>
              <div className="relative">
                <Input
                  type={showRemovePin ? 'text' : 'password'}
                  value={removePinInput}
                  onChange={(e) => setRemovePinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter PIN"
                  disabled={loading}
                  inputMode="numeric"
                  maxLength={6}
                  className="pr-10 text-center tracking-widest text-lg font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowRemovePin(!showRemovePin)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showRemovePin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep('status')}
                disabled={loading}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                variant="destructive"
                className="flex-1"
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {loading ? 'Removing...' : 'Remove PIN'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
