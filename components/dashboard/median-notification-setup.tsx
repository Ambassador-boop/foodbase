'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { isMedianEnvironment, initializeOneSignalFlow, requestPushPermission } from '@/lib/median-bridge';
import { setupMedianNotificationHandler } from '@/lib/median-notification-handler';

interface NotificationSetupProps {
  userEmail?: string;
}

/**
 * MedianNotificationSetup Component
 *
 * This component initializes the Median JavaScript Bridge integration with OneSignal.
 * It must be rendered once in your app (ideally in the root layout or dashboard layout).
 *
 * Responsibilities:
 * 1. Detects if running in Median app environment
 * 2. Initializes OneSignal with user email
 * 3. Retrieves device token and stores in backend
 * 4. Sets up notification tap handlers
 * 5. Provides push permission request capability
 *
 * Features:
 * - Automatically sends notifications on order creation
 * - Updates notifications when payment is completed
 * - Gracefully falls back to regular browser functionality
 * - Works in both web browsers and Median app
 */
export function MedianNotificationSetup({ userEmail }: NotificationSetupProps) {
  const router = useRouter();
  const [isInitialized, setIsInitialized] = useState(false);
  const [isMedianEnvironment, setIsMedianEnvironment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Expose global function to request push permissions
  useCallback(() => {
    if (typeof window !== 'undefined' && !window.requestMedianPushNotifications) {
      window.requestMedianPushNotifications = async () => {
        try {
          const result = await requestPushPermission();
          console.log('[v0] Push notification permission requested:', result);
          return result;
        } catch (err) {
          console.error('[v0] Failed to request push permissions:', err);
          return false;
        }
      };
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function setup() {
      try {
        // Check if we're in Median environment
        const isMedian = isMedianEnvironment();

        console.log('[v0] MedianNotificationSetup: Environment check:', {
          isMedian,
        });

        if (mounted) {
          setIsMedianEnvironment(isMedian);
        }

        // If in Median environment, initialize OneSignal
        if (isMedian && userEmail) {
          console.log('[v0] MedianNotificationSetup: Initializing OneSignal flow...');
          const oneSignalUserId = await initializeOneSignalFlow(userEmail);

          if (oneSignalUserId && mounted) {
            console.log('[v0] MedianNotificationSetup: OneSignal initialized successfully:', oneSignalUserId);
            setIsInitialized(true);

            // Setup notification handler for tap events
            setupMedianNotificationHandler(router);
          } else if (mounted) {
            console.error('[v0] MedianNotificationSetup: OneSignal initialization returned null');
            setIsInitialized(false);
          }
        } else {
          console.log('[v0] MedianNotificationSetup: Not in Median environment, skipping initialization');
          if (mounted) {
            setIsInitialized(true); // Mark as initialized even for web (graceful fallback)
          }
        }
      } catch (err) {
        console.error('[v0] MedianNotificationSetup: Setup failed:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Setup failed');
          // Retry setup after a delay (max 3 retries)
          if (retryCount < 3) {
            setTimeout(() => {
              setRetryCount((prev) => prev + 1);
            }, 2000);
          }
        }
      }
    }

    setup();
    return () => {
      mounted = false;
    };
  }, [userEmail, retryCount]);

  // Log initialization status (helpful for debugging)
  useEffect(() => {
    if (isInitialized) {
      console.log('[v0] MedianNotificationSetup: Initialization complete', {
        isMedianEnvironment,
        isInitialized,
        userEmail: userEmail ? userEmail.substring(0, 3) + '***' : 'unknown',
      });
    }
  }, [isInitialized, isMedianEnvironment, userEmail]);

  // This component doesn't render anything visible
  // It's purely for initialization purposes
  return null;
}
