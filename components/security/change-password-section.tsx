'use client';

import { useState } from 'react';
import { Eye, EyeOff, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface OTPVerificationState {
  otpId: string;
  email: string;
}

export default function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [otpState, setOtpState] = useState<OTPVerificationState | null>(null);
  const [otp, setOtp] = useState('');
  const [otpLoading, setOtpLoading] = useState(false);

  const handleRequestPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/user/password/request-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to request password change');
        setLoading(false);
        return;
      }

      setOtpState({
        otpId: data.otpId,
        email: data.email || 'your email',
      });
      setStep('otp');
      setSuccess('OTP sent to your email');
    } catch (err) {
      setError('Failed to request password change');
      console.error('[v0] Password change error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAndChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!otp) {
      setError('OTP is required');
      return;
    }

    if (!otpState) {
      setError('Invalid request state');
      return;
    }

    setOtpLoading(true);
    try {
      const res = await fetch('/api/user/password/verify-and-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          otpId: otpState.otpId,
          otp,
          newPassword,
          confirmPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to change password');
        setOtpLoading(false);
        return;
      }

      setSuccess('Password changed successfully!');
      setStep('form');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setOtp('');
      setOtpState(null);
    } catch (err) {
      setError('Failed to verify OTP');
      console.error('[v0] OTP verification error:', err);
    } finally {
      setOtpLoading(false);
    }
  };

  return (
    <div className="p-6 rounded-lg border border-border bg-white">
      <h3 className="font-semibold text-foreground mb-2">Change Password</h3>
      <p className="text-sm text-muted-foreground mb-6">
        Update your password to keep your account secure
      </p>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}

      {step === 'form' ? (
        <form onSubmit={handleRequestPasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Current Password
            </label>
            <div className="relative">
              <Input
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                disabled={loading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              New Password
            </label>
            <div className="relative">
              <Input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter your new password (min. 8 characters)"
                disabled={loading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                disabled={loading}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {loading ? 'Sending OTP...' : 'Continue'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleVerifyAndChange} className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="text-sm text-muted-foreground">
              A verification code has been sent to {otpState?.email}
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
              disabled={otpLoading}
              maxLength={6}
              className="text-center tracking-widest text-lg"
            />
          </div>

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStep('form');
                setOtp('');
                setOtpState(null);
              }}
              disabled={otpLoading}
              className="flex-1"
            >
              Back
            </Button>
            <Button type="submit" disabled={otpLoading} className="flex-1">
              {otpLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {otpLoading ? 'Verifying...' : 'Verify & Change'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
