/**
 * The kitchen's transition rules, in one place, imported by both the API (to
 * enforce) and the board (to decide which button to show). A rule the server
 * would reject must never be offered as a tap target.
 *
 *   pending  -> preparing        (start)
 *   preparing-> ready            (mark ready)
 *   ready    -> preparing        (recall)
 *
 * Nothing else. Completed, cancelled and out-for-delivery orders never reach
 * this module because they are already excluded from the board.
 */

import type { KitchenStage } from './types';

export const KITCHEN_STAGE_STATUS: Record<KitchenStage, string> = {
  new: 'pending',
  preparing: 'preparing',
  ready: 'ready',
};

export const KITCHEN_STAGES: KitchenStage[] = ['new', 'preparing', 'ready'];

/** The only moves the kitchen may make. */
export const KITCHEN_TRANSITIONS: Record<KitchenStage, KitchenStage[]> = {
  new: ['preparing'],
  preparing: ['ready'],
  ready: ['preparing'],
};

/** Statuses that are finished: they are rejected explicitly, not by omission. */
export const FINAL_STATUSES = ['completed', 'cancelled', 'canceled', 'out_for_delivery'];

export function stageForStatus(status: unknown): KitchenStage | null {
  const value = String(status ?? '').trim().toLowerCase();
  if (value === 'pending') return 'new';
  if (value === 'preparing') return 'preparing';
  if (value === 'ready') return 'ready';
  return null;
}

export function isKitchenTransition(from: KitchenStage, to: KitchenStage): boolean {
  return KITCHEN_TRANSITIONS[from].includes(to);
}

export function isFinalStatus(status: unknown): boolean {
  return FINAL_STATUSES.includes(String(status ?? '').trim().toLowerCase());
}

/** The label on the one large button a ticket offers. */
export function actionLabelFor(stage: KitchenStage): string {
  if (stage === 'new') return 'Start preparing';
  if (stage === 'preparing') return 'Mark ready';
  return 'Move back to preparing';
}

export const REJECTION_MESSAGES = {
  not_found: 'That order is not on this kitchen board.',
  unpaid:
    'This order has not been paid for. The kitchen only ever shows orders that have been paid.',
  final_state:
    'This order is finished. Completed, cancelled and out-for-delivery orders cannot be moved from the kitchen.',
  illegal_transition:
    'The kitchen can only start a new order, mark a preparing order ready, or move a ready order back to preparing.',
  not_configured: 'The kitchen display needs a one-time database update before it can change an order.',
  unauthorized: 'Sign in to the restaurant dashboard to use the kitchen display.',
} as const;
