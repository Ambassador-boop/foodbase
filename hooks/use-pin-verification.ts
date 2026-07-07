import { useState } from 'react';

interface PinVerificationState {
  isOpen: boolean;
  pinId: string | null;
  purpose: 'bank_account' | 'withdrawal';
  isLoading: boolean;
  error: string | null;
  method: 'sms' | 'email' | 'pin' | null;
  message: string | null;
}

export function usePinVerification() {
  const [state, setState] = useState<PinVerificationState>({
    isOpen: false,
    pinId: null,
    purpose: 'bank_account',
    isLoading: false,
    error: null,
    method: null,
    message: null,
  });

  const requestPin = async (
    purpose: 'bank_account' | 'withdrawal',
    metadata: any
  ) => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/pins/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          purpose,
          metadata,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to request PIN');
      }

      const method = data.method || 'sms';
      let message = '';
      if (method === 'sms') {
        message = 'A verification code has been sent to your phone';
      } else if (method === 'email') {
        message = 'A verification code has been sent to your email';
      } else if (method === 'pin') {
        message = 'Enter your PIN to continue';
      }

      setState((prev) => ({
        ...prev,
        isOpen: method !== 'pin', // Only show modal if not PIN mode (PIN mode shows immediately)
        pinId: data.pinId,
        purpose,
        method,
        message,
        isLoading: false,
      }));

      return { success: true, pinId: data.pinId, method, message };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to request PIN';
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));

      throw new Error(errorMessage);
    }
  };

  const verifyPin = async (pin: string) => {
    if (!state.pinId) {
      throw new Error('No PIN request in progress');
    }

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      const response = await fetch('/api/pins/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pinId: state.pinId,
          pin,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify PIN');
      }

      setState((prev) => ({
        ...prev,
        isOpen: false,
        pinId: null,
        method: null,
        message: null,
        isLoading: false,
      }));

      return { success: true, purpose: data.purpose };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to verify PIN';
      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isLoading: false,
      }));

      throw new Error(errorMessage);
    }
  };

  const closeModal = () => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
      error: null,
      method: null,
      message: null,
    }));
  };

  return {
    isOpen: state.isOpen,
    pinId: state.pinId,
    purpose: state.purpose,
    isLoading: state.isLoading,
    error: state.error,
    method: state.method,
    message: state.message,
    requestPin,
    verifyPin,
    closeModal,
  };
}
