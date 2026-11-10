/**
 * Shared pricing constants and helpers.
 *
 * This module is imported by BOTH the checkout page (client) and the orders
 * API route (server). Keeping the delivery fee here is deliberate: the page
 * must display exactly the amount the server will charge, so the two can
 * never drift apart.
 */

/** Flat delivery fee in Naira, charged only when deliveryType === 'delivery'. */
export const DELIVERY_FEE = 1000;

/** Prefix the storefront puts in front of drink ids in the cart, e.g. `drink_abc123`. */
export const DRINK_ID_PREFIX = 'drink_';

/** Round a money amount to 2 decimals (avoids 0.1 + 0.2 style drift). */
export function round2(amount: number): number {
  const n = Number(amount);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}
