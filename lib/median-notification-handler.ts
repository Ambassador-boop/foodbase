/**
 * Median notification open handler
 * Handles when user taps a notification in the Median app
 * Parses notification payload and routes to relevant page
 */

import { useRouter } from 'next/navigation';

interface NotificationPayload {
  orderId?: string;
  type?: string;
  targetUrl?: string;
  [key: string]: any;
}

/**
 * Set up the notification open handler callback
 * Should be called once on app initialization in a client component
 */
export function setupMedianNotificationHandler(router: ReturnType<typeof useRouter>) {
  if (typeof window === 'undefined') {
    return;
  }

  /**
   * This callback is called by the Median app when user opens a notification
   */
  (window as any).medianOpenedPushNotification = (payload: NotificationPayload) => {
  
    try {
      // If there's a target URL in the notification, navigate to it
      if (payload.targetUrl) {
              router.push(payload.targetUrl);
        return;
      }

      // If there's an order ID, navigate to order detail page
      if (payload.orderId) {
        const orderDetailUrl = `/dashboard/orders/${payload.orderId}`;
        console.log('[v0] Routing to order detail page:', orderDetailUrl);
        router.push(orderDetailUrl);
        return;
      }

      // Default: go to orders list
      console.log('[v0] No specific target, routing to orders list');
      router.push('/dashboard/orders');
    } catch (error) {
      console.error('[v0] Error handling notification open:', error);
      // Fallback to orders list
      router.push('/dashboard/orders');
    }
  };

  console.log('[v0] Median notification handler installed');
}

/**
 * Remove the notification open handler
 * Useful for cleanup on component unmount
 */
export function removeMedianNotificationHandler() {
  if (typeof window !== 'undefined') {
    delete (window as any).medianOpenedPushNotification;
    console.log('[v0] Median notification handler removed');
  }
}
