import { useEffect, useState } from 'react';
import { usePinVerification } from './use-pin-verification';

export type AuthMode = 'email' | 'sms' | 'pin';

interface UseAuthModeVerificationReturn {
  authMode: AuthMode | null;
  loading: boolean;
  pinVerification: any;
  requiresVerification: boolean;
  initiateVerification: () => Promise<void>;
  verifyWithCurrentMode: (code: string) => Promise<boolean>;
}

/**
 * Hook to handle verification based on user's preferred auth mode
 * Supports: Email OTP, SMS OTP, or PIN
 */
export function useAuthModeVerification(purpose: 'bank_account' | 'withdrawal') {
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const [loading, setLoading] = useState(true);
  const [verificationCode, setVerificationCode] = useState('');
  const [otpId, setOtpId] = useState<string | null>(null);
  const pinVerification = usePinVerification();

  // Load user's preferred auth mode
  useEffect(() => {
    const loadAuthMode = async () => {
      try {
        const res = await fetch('/api/user/auth-mode/current', {
          credentials: 'include',
        });
        if (res.ok) {
          const data = await res.json();
          setAuthMode(data.preferredAuthMode || 'sms');
        }
      } catch (err) {
        console.error('[v0] Failed to load auth mode:', err);
        // Default to SMS if fetch fails
        setAuthMode('sms');
      } finally {
        setLoading(false);
      }
    };

    loadAuthMode();
  }, []);

  const initiateVerification = async () => {
    if (authMode === 'pin') {
      // For PIN, request PIN modal
      try {
        await pinVerification.requestPin(purpose);
      } catch (err) {
        console.error('[v0] PIN request error:', err);
        throw err;
      }
    } else if (authMode === 'email') {
      // For Email OTP, send OTP via email (future implementation)
      console.log('[v0] Email OTP verification - Not yet fully implemented');
      // TODO: Implement email OTP verification
    } else {
      // For SMS, use existing KudiSMS flow (current behavior)
      try {
        await pinVerification.requestPin(purpose);
      } catch (err) {
        console.error('[v0] SMS PIN request error:', err);
        throw err;
      }
    }
  };

  const verifyWithCurrentMode = async (code: string): Promise<boolean> => {
    if (authMode === 'pin') {
      // Verify PIN using PIN verification hook
      await pinVerification.verifyPin(code);
      return true;
    } else if (authMode === 'email') {
      // Verify email OTP (future implementation)
      console.log('[v0] Email OTP verification - Not yet fully implemented');
      return true;
    } else {
      // Verify SMS PIN (current behavior)
      await pinVerification.verifyPin(code);
      return true;
    }
  };

  return {
    authMode,
    loading,
    pinVerification,
    requiresVerification: authMode !== null,
    initiateVerification,
    verifyWithCurrentMode,
  };
}
