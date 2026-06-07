import { useState } from 'react';

interface PinVerificationState {
  isOpen: boolean;
  pinId: string | null;
  purpose: 'bank_account' | 'withdrawal';
  isLoading: boolean;
  error: string | null;
}

export function usePinVerification() {
  const [state, setState] = useState<PinVerificationState>({
    isOpen: false,
    pinId: null,
    purpose: 'bank_account',
    isLoading: false,
    error: null,
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

      setState((prev) => ({
        ...prev,
        isOpen: true,
        pinId: data.pinId,
        purpose,
        isLoading: false,
      }));

      return { success: true, pinId: data.pinId };
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
    }));
  };

  return {
    isOpen: state.isOpen,
    pinId: state.pinId,
    purpose: state.purpose,
    isLoading: state.isLoading,
    error: state.error,
    requestPin,
    verifyPin,
    closeModal,
  };
}
