'use client';

import { useState } from 'react';
import { Mail, MessageSquare, Lock, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AuthModeSelectorProps {
  currentMode: 'email' | 'sms' | 'pin';
  hasPinSet: boolean;
  onModeChange: (mode: 'email' | 'sms' | 'pin') => void;
}

const authModes = [
  {
    id: 'email',
    name: 'Email OTP',
    description: 'Receive verification codes via email',
    icon: Mail,
  },
  {
    id: 'sms',
    name: 'SMS OTP',
    description: 'Receive verification codes via SMS',
    icon: MessageSquare,
  },
  {
    id: 'pin',
    name: 'PIN',
    description: 'Use a personal 4-6 digit PIN',
    icon: Lock,
  },
];

export default function AuthModeSelectorSection({
  currentMode,
  hasPinSet,
  onModeChange,
}: AuthModeSelectorProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedMode, setSelectedMode] = useState<'email' | 'sms' | 'pin'>(currentMode);

  const handleModeChange = async (newMode: 'email' | 'sms' | 'pin') => {
    if (newMode === currentMode) return;

    // PIN requires PIN to be set
    if (newMode === 'pin' && !hasPinSet) {
      setError('Please set up a PIN first in the PIN Management section');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch('/api/user/auth-mode/change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ newMode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to change authentication mode');
        setLoading(false);
        return;
      }

      setSelectedMode(newMode);
      onModeChange(newMode);
      setSuccess(`Authentication mode changed to ${newMode.toUpperCase()}`);
    } catch (err) {
      setError('Failed to change authentication mode');
      console.error('[v0] Auth mode change error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 rounded-lg border border-border bg-white">
      <h3 className="font-semibold text-foreground mb-2">
        Authentication Method
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        Choose how you want to verify sensitive actions
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

      <div className="space-y-3">
        {authModes.map((mode) => {
          const Icon = mode.icon;
          const isSelected = selectedMode === mode.id;
          const isDisabled = mode.id === 'pin' && !hasPinSet;

          return (
            <button
              key={mode.id}
              onClick={() => !isDisabled && handleModeChange(mode.id as any)}
              disabled={loading || isDisabled}
              className={`w-full p-4 rounded-lg border-2 text-left transition-all ${
                isSelected
                  ? 'border-primary bg-primary/5'
                  : isDisabled
                  ? 'border-border bg-muted/30 cursor-not-allowed opacity-60'
                  : 'border-border bg-white hover:border-primary/30 hover:bg-primary/2.5'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                  <Icon className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                    isSelected ? 'text-primary' : 'text-muted-foreground'
                  }`} />
                  <div>
                    <p className={`font-medium ${
                      isSelected ? 'text-primary' : 'text-foreground'
                    }`}>
                      {mode.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {mode.description}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {isSelected && (
                    <span className="px-2 py-1 rounded-full bg-primary text-white text-xs font-medium">
                      Active
                    </span>
                  )}
                  {isDisabled && mode.id === 'pin' && (
                    <span className="px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                      Set PIN First
                    </span>
                  )}
                  {loading && isSelected && (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  )}
                  {!isSelected && !isDisabled && (
                    <div className="w-5 h-5 rounded-full border-2 border-border" />
                  )}
                  {isSelected && !loading && (
                    <div className="w-5 h-5 rounded-full border-2 border-primary bg-primary" />
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 p-4 rounded-lg bg-muted/50">
        <p className="text-xs text-muted-foreground">
          <strong>Note:</strong> This setting applies to sensitive actions like updating bank details and requesting withdrawals.
        </p>
      </div>
    </div>
  );
}
