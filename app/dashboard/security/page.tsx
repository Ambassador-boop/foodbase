'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ChangePasswordSection from '@/components/security/change-password-section';
import AuthModeSelectorSection from '@/components/security/auth-mode-selector';
import PINManagementSection from '@/components/security/pin-management';

export default function SecurityPage() {
  const [preferredAuthMode, setPreferredAuthMode] = useState<'email' | 'sms' | 'pin'>('sms');
  const [hasPinSet, setHasPinSet] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadSecuritySettings = async () => {
      try {
        setLoading(true);
        
        // Fetch current auth mode
        const authModeRes = await fetch('/api/user/auth-mode/current', {
          credentials: 'include',
        });
        if (authModeRes.ok) {
          const data = await authModeRes.json();
          setPreferredAuthMode(data.preferredAuthMode || 'sms');
        }

        // Fetch PIN status
        const pinStatusRes = await fetch('/api/user/pin/status', {
          credentials: 'include',
        });
        if (pinStatusRes.ok) {
          const data = await pinStatusRes.json();
          setHasPinSet(data.hasPinSet);
        }

        setError(null);
      } catch (err) {
        console.error('[v0] Security settings error:', err);
        setError('Failed to load security settings');
      } finally {
        setLoading(false);
      }
    };

    loadSecuritySettings();

    // Listen for visibility changes to refresh PIN status when returning to page
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadSecuritySettings();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleAuthModeChange = (newMode: 'email' | 'sms' | 'pin') => {
    setPreferredAuthMode(newMode);
  };

  const handlePinStatusChange = (isPinSet: boolean) => {
    setHasPinSet(isPinSet);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground">Loading security settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Security Settings
          </h1>
          <p className="text-muted-foreground">
            Manage your password and authentication methods
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Sections */}
        <div className="space-y-6">
          {/* Change Password Section */}
          <ChangePasswordSection />

          {/* Authentication Mode Selection */}
          <AuthModeSelectorSection
            currentMode={preferredAuthMode}
            hasPinSet={hasPinSet}
            onModeChange={handleAuthModeChange}
          />

          {/* PIN Management Section */}
          <PINManagementSection
            hasPinSet={hasPinSet}
            onPinStatusChange={handlePinStatusChange}
          />

          {/* Active Sessions (Future) */}
          <div className="p-6 rounded-lg border border-border bg-white">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-foreground mb-1">
                  Active Sessions
                </h3>
                <p className="text-sm text-muted-foreground">
                  Manage devices and active login sessions
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
                Coming soon
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
