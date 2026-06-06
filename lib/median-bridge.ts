/**
 * Median JavaScript Bridge utilities for OneSignal integration
 * Provides safe wrappers around Median native API calls with environment detection
 */

// Type definitions for Median bridge
interface MedianOneSignal {
  login(externalId: string): Promise<void>;
  logout(): Promise<void>;
  promptForPushNotifications(): Promise<boolean>;
  info(): Promise<OneSignalInfo>;
}

interface OneSignalInfo {
  oneSignalUserId: string;
  externalId: string;
}

interface MedianBridge {
  isNativeApp: boolean;
  onesignal: MedianOneSignal;
}

declare global {
  interface Window {
    median?: MedianBridge;
  }
}

/**
 * Detects if code is running in Median native app environment
 */
export function isMedianEnvironment(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }

  return !!(window.median && window.median.isNativeApp);
}

/**
 * Initialize OneSignal via Median bridge with user email as external ID
 * Safe to call in any environment - will silently fail in non-Median
 */
export async function initOneSignal(userEmail: string): Promise<boolean> {
  if (!isMedianEnvironment()) {
    console.log('[v0] Not in Median environment, skipping OneSignal init');
    return false;
  }

  try {
    console.log('[v0] Initializing OneSignal for user:', userEmail);
    await window.median!.onesignal.login(userEmail);
    console.log('[v0] OneSignal initialized successfully');
    return true;
  } catch (error) {
    console.error('[v0] Failed to initialize OneSignal:', error);
    return false;
  }
}

/**
 * Request push notification permissions from user
 * Should be called after user interaction (button click, onboarding, etc.)
 */
export async function requestPushPermission(): Promise<boolean> {
  if (!isMedianEnvironment()) {
    console.log('[v0] Not in Median environment, cannot request push permission');
    return false;
  }

  try {
    console.log('[v0] Requesting push notification permission');
    const granted = await window.median!.onesignal.promptForPushNotifications();
    console.log('[v0] Push permission result:', granted);
    return granted;
  } catch (error) {
    console.error('[v0] Failed to request push permission:', error);
    return false;
  }
}

/**
 * Retrieve OneSignal user information
 * Returns oneSignalUserId and externalId for associating device with user
 */
export async function getOneSignalInfo(): Promise<OneSignalInfo | null> {
  if (!isMedianEnvironment()) {
    console.log('[v0] Not in Median environment, cannot get OneSignal info');
    return null;
  }

  try {
    console.log('[v0] Retrieving OneSignal info');
    const info = await window.median!.onesignal.info();
    console.log('[v0] OneSignal info retrieved:', {
      oneSignalUserId: info.oneSignalUserId,
      externalId: info.externalId,
    });
    return info;
  } catch (error) {
    console.error('[v0] Failed to get OneSignal info:', error);
    return null;
  }
}

/**
 * Logout from OneSignal and unlink device
 * Should be called when user logs out of the app
 */
export async function logoutOneSignal(): Promise<boolean> {
  if (!isMedianEnvironment()) {
    console.log('[v0] Not in Median environment, skipping OneSignal logout');
    return false;
  }

  try {
    console.log('[v0] Logging out from OneSignal');
    await window.median!.onesignal.logout();
    console.log('[v0] OneSignal logout successful');
    return true;
  } catch (error) {
    console.error('[v0] Failed to logout from OneSignal:', error);
    return false;
  }
}

/**
 * Complete initialization flow: login to OneSignal and save device token
 * Returns OneSignal user ID if successful, null otherwise
 */
export async function initializeOneSignalFlow(
  userEmail: string
): Promise<string | null> {
  // Initialize OneSignal
  const initSuccess = await initOneSignal(userEmail);
  if (!initSuccess) {
    return null;
  }

  // Get OneSignal info
  const info = await getOneSignalInfo();
  if (!info) {
    return null;
  }

  // Save device token to backend
  try {
    const response = await fetch('/api/save-push-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        oneSignalUserId: info.oneSignalUserId,
        externalId: info.externalId,
        email: userEmail,
      }),
    });

    if (!response.ok) {
      console.error('[v0] Failed to save push token');
      return null;
    }

    console.log('[v0] Push token saved successfully');
    return info.oneSignalUserId;
  } catch (error) {
    console.error('[v0] Error saving push token:', error);
    return null;
  }
}
