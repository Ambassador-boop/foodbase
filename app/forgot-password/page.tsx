'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Step = 'email' | 'otp' | 'password' | 'success';

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpId, setOtpId] = useState('');

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to send OTP');
        return;
      }

      setOtpId(data.otpId);
      setStep('otp');
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otpId, otp, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to reset password');
        return;
      }

      setStep('success');
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link href="/forgot-password" className="flex items-center gap-2 mb-8">
          <Image
            src="/foodbase-logo.png"
            alt="FoodBase"
            width={32}
            height={32}
          />
          <span className="font-bold text-primary">FoodBase</span>
        </Link>

        {step === 'email' && (
          <>
            <h2 className="text-2xl font-bold mb-1">Reset Password</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Enter your email to receive a verification code
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-xs font-semibold">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-9 bg-primary text-white hover:bg-primary-dark text-sm font-medium"
              >
                {loading ? 'Sending...' : 'Send Verification Code'}
              </Button>
            </form>
          </>
        )}

        {step === 'otp' && (
          <>
            <h2 className="text-2xl font-bold mb-1">Verify Email</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Enter the 6-digit code sent to {email}
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStep('password');
              }}
              className="space-y-4"
            >
              <div>
                <Label htmlFor="otp" className="text-xs font-semibold">
                  Verification Code
                </Label>
                <Input
                  id="otp"
                  type="text"
                  placeholder="000000"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.slice(0, 6))}
                  maxLength={6}
                  required
                  className="mt-1 h-9 text-sm text-center text-2xl tracking-widest"
                />
              </div>

              <Button
                type="submit"
                disabled={otp.length !== 6}
                className="w-full h-9 bg-primary text-white hover:bg-primary-dark text-sm font-medium"
              >
                Continue
              </Button>
            </form>
          </>
        )}

        {step === 'password' && (
          <>
            <h2 className="text-2xl font-bold mb-1">New Password</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Create a strong password for your account
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div>
                <Label htmlFor="newPassword" className="text-xs font-semibold">
                  New Password
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="text-xs font-semibold">
                  Confirm Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="mt-1 h-9 text-sm"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-9 bg-primary text-white hover:bg-primary-dark text-sm font-medium"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>
            </form>
          </>
        )}

        {step === 'success' && (
          <>
            <div className="text-center">
              <div className="mb-4 text-5xl text-green-500">✓</div>
              <h2 className="text-2xl font-bold mb-2">Password Reset</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Your password has been successfully reset. You can now log in with your new password.
              </p>

              <Link href="/login">
                <Button className="w-full h-9 bg-primary text-white hover:bg-primary-dark text-sm font-medium">
                  Go to Login
                </Button>
              </Link>
            </div>
          </>
        )}

        <div className="mt-6 text-center text-xs text-muted-foreground">
          <Link href="/login" className="text-primary hover:text-primary-dark font-medium">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
