'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  initializeOneSignalFlow,
  requestPushPermission,
  isMedianEnvironment,
} from '@/lib/median-bridge';
import { setupMedianNotificationHandler } from '@/lib/median-notification-handler';

interface NotificationSetupProps {
  userEmail: string;
  onInitComplete?: () => void;
}

/**
 * Component that handles OneSignal initialization and notification handler setup
 * Should be rendered in the dashboard layout after login
 */
export function MedianNotificationSetup({
  userEmail,
  onInitComplete,
}: NotificationSetupProps) {
  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  useEffect(() => {
    // Setup happens only in Median environment
    if (!isMedianEnvironment()) {
      console.log('[v0] Not in Median environment, skipping notification setup');
      return;
    }

    const setupNotifications = async () => {
      try {
        console.log('[v0] Starting OneSignal initialization for:', userEmail);

        // Initialize OneSignal and save push token
        const oneSignalUserId = await initializeOneSignalFlow(userEmail);

        if (oneSignalUserId) {
          console.log('[v0] OneSignal initialized successfully:', oneSignalUserId);
          setIsInitialized(true);

          // Request push permission (can be called after a delay or user interaction)
          // For now, we'll request it after a short delay to avoid too many prompts
          setTimeout(() => {
            requestPushPermission().catch((error) => {
              console.error('[v0] Push permission error:', error);
            });
          }, 2000);
        } else {
          console.warn('[v0] OneSignal initialization failed');
          setInitError('Failed to initialize push notifications');
        }

        // Setup the notification open handler callback
        setupMedianNotificationHandler(router);

        if (onInitComplete) {
          onInitComplete();
        }
      } catch (error) {
        console.error('[v0] Notification setup error:', error);
        setInitError(error instanceof Error ? error.message : 'Unknown error');
      }
    };

    setupNotifications();

    // Cleanup handler on unmount
    return () => {
      // Handler is set globally and should persist
    };
  }, [userEmail, router, onInitComplete]);

  // This component doesn't render anything visible
  // It just handles the setup logic
  if (initError) {
    console.warn('[v0] Notification setup warning:', initError);
  }

  return null;
}

/**
 * Alternative hook-based approach for notification setup
 */
export function useMedianNotifications(userEmail?: string) {
  const router = useRouter();
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inMedianApp, setInMedianApp] = useState(false);

  useEffect(() => {
    const isMedian = isMedianEnvironment();
    setInMedianApp(isMedian);

    if (!isMedian || !userEmail) {
      return;
    }

    const init = async () => {
      try {
        const userId = await initializeOneSignalFlow(userEmail);
        if (userId) {
          setupMedianNotificationHandler(router);
          setInitialized(true);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      }
    };

    init();
  }, [userEmail, router]);

  return { initialized, error, inMedianApp };
}

/**
 * Hook to request push notification permission (to be called on user interaction)
 */
export async function useRequestPushPermission() {
  if (!isMedianEnvironment()) {
    return { granted: false, error: 'Not in Median environment' };
  }

  try {
    const granted = await requestPushPermission();
    return { granted, error: null };
  } catch (error) {
    return {
      granted: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
