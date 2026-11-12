/**
 * The shape the kitchen board consumes. Presentation-free on purpose: the API
 * returns exactly this, the board renders exactly this, and nothing else has to
 * know how an order is stored.
 */

export type KitchenStage = 'new' | 'preparing' | 'ready';

export type KitchenFulfilment = 'delivery' | 'dine_in' | 'pickup';

export interface KitchenAddon {
  name: string;
  /** Null when the stored add-on carries no price (legacy rows). */
  price: number | null;
}

export interface KitchenLine {
  id: string;
  name: string;
  quantity: number;
  addons: KitchenAddon[];
}

export interface KitchenOrder {
  id: string;
  /** First eight characters, uppercase: what a cook reads out loud. */
  shortId: string;
  stage: KitchenStage;
  /** The raw `orders.status` value, for debugging and for the recall check. */
  status: string;
  fulfilment: KitchenFulfilment;
  tableLabel: string | null;
  customerName: string | null;
  total: number;
  /** Total units, not lines: three jollof plus one water is four items. */
  itemCount: number;
  notes: string | null;
  items: KitchenLine[];
  /** ISO-8601. Elapsed time is measured from here; never from the browser's clock. */
  paidAt: string;
  /** ISO-8601 when the pass marked it ready, or null. */
  readyAt: string | null;
  /** The owner's prep estimate for this ticket, in minutes, when stored. */
  prepMinutes: number | null;
}

export interface KitchenStats {
  paidToday: number;
  readyToday: number;
  /** Seconds between payment and ready, averaged over today. Null when nothing is ready yet. */
  averagePrepSeconds: number | null;
  /** Seconds on the oldest open ticket, or null when the board is empty. */
  oldestOpenSeconds: number | null;
}

export interface KitchenCapabilities {
  /** `orders.table_label` exists (Batch 3B). */
  tableLabel: boolean;
  /** `orders.kitchen_prep_minutes` exists (Batch 3C). */
  prepMinutes: boolean;
  /** `orders.kitchen_ready_at` exists (Batch 3C). */
  readyAt: boolean;
}

export interface KitchenBoardPayload {
  success: true;
  business: { id: string; name: string };
  generatedAt: string;
  /** Server-computed state signature, also sent as the ETag. */
  etag: string;
  capabilities: KitchenCapabilities;
  orders: KitchenOrder[];
  stats: KitchenStats;
}

export type KitchenTransitionResult = {
  success: true;
  orderId: string;
  stage: KitchenStage;
  status: string;
  changedAt: string;
};

export type KitchenRejectionCode =
  | 'not_found'
  | 'unpaid'
  | 'final_state'
  | 'illegal_transition'
  | 'not_configured'
  | 'unauthorized';

export type KitchenTransitionError = {
  error: string;
  code: KitchenRejectionCode;
};
