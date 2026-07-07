'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Loader2, AlertCircle, CheckCircle, Trash2, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PINManagementProps {
  hasPinSet: boolean;
  onPinStatusChange: (isPinSet: boolean) => void;
}

export default function PINManagementSection({
  hasPinSet,
  onPinStatusChange,
}: PINManagementProps) {
  const router = useRouter();
  const [isPinSet, setIsPinSet] = useState(hasPinSet);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [removePinInput, setRemovePinInput] = useState('');
  const [showRemovePin, setShowRemovePin] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  // Check PIN status on mount
  useEffect(() => {
    checkPinStatus();
  }, []);

  const checkPinStatus = async () => {
    try {
      const res = await fetch('/api/user/pin/status', {
        credentials: 'include',
      });

      if (res.ok) {
        const data = await res.json();
        setIsPinSet(data.hasPinSet);
      }
    } catch (err) {
      console.error('[v0] PIN status check error:', err);
    }
  };

  const handleSetupClick = () => {
    router.push('/dashboard/security/pin');
  };

  const handleRemovePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!removePinInput) {
      setError('Please enter your PIN to remove it');
      return;
    }

    if (!/^\d{4,6}$/.test(removePinInput)) {
      setError('Invalid PIN format');
      return;
    }

    setIsRemoving(true);

    try {
      const res = await fetch('/api/user/pin/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pin: removePinInput,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to remove PIN');
        return;
      }

      setSuccess('PIN removed successfully');
      setRemovePinInput('');
      setIsPinSet(false);
      onPinStatusChange(false);

      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err) {
      setError('Failed to remove PIN');
      console.error('[v0] PIN removal error:', err);
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">PIN Security</h3>
            <p className="text-sm text-gray-600 mt-1">
              A PIN adds extra security for sensitive transactions
            </p>
          </div>
          <div
            className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              isPinSet
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            {isPinSet ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Active
              </>
            ) : (
              <>
                <AlertCircle className="w-4 h-4 mr-2" />
                Not Set
              </>
            )}
          </div>
        </div>

        {!isPinSet ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">
              Set up a PIN to protect your account when:
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                Updating bank account details
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                Processing withdrawal requests
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600 mt-0.5">•</span>
                Changing security settings
              </li>
            </ul>

            <button
              onClick={handleSetupClick}
              disabled={loading}
              className="mt-4 w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <Lock className="w-4 h-4" />
              Set Up PIN Now
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-sm text-green-800">
                ✓ Your PIN is active and protecting your account
              </p>
            </div>

            <form onSubmit={handleRemovePin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter PIN to Remove
                </label>
                <div className="relative">
                  <input
                    type={showRemovePin ? 'text' : 'password'}
                    inputMode="numeric"
                    placeholder="••••"
                    value={removePinInput}
                    onChange={(e) => {
                      setRemovePinInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                      setError(null);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-center tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => setShowRemovePin(!showRemovePin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showRemovePin ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <Alert className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-700">{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="bg-green-50 border-green-200">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-700">{success}</AlertDescription>
                </Alert>
              )}

              <button
                type="submit"
                disabled={isRemoving || !removePinInput}
                className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {isRemoving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Removing...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Remove PIN
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
