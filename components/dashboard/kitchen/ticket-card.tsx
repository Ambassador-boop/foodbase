'use client';

import { useState } from 'react';
import { Loader2, Printer } from 'lucide-react';
import type { KitchenOrder, KitchenStage } from '@/lib/kitchen/types';
import {
  formatElapsed,
  urgencyFor,
  type KitchenThresholds,
  type KitchenUrgency,
} from '@/lib/kitchen/device-settings';
import { formatWatTime } from '@/lib/wat';

/** The prep estimates the pass can promise. Deliberately short: a card is not a form. */
export const PREP_CHOICES = [10, 15, 20, 30] as const;

const URGENCY_FLAG: Record<KitchenUrgency, string> = {
  calm: 'On time',
  attention: 'Watch',
  over: 'Over target',
  'well-over': 'Well over',
};

const FULFILMENT_LABEL: Record<KitchenOrder['fulfilment'], string> = {
  delivery: 'Delivery',
  dine_in: 'Dine in',
  pickup: 'Pickup',
};

function elapsedSeconds(order: KitchenOrder, now: number): number {
  const paid = new Date(order.paidAt).getTime();
  if (!Number.isFinite(paid)) return 0;
  return Math.max(0, Math.round((now - paid) / 1000));
}

export interface KitchenTicketProps {
  order: KitchenOrder;
  /** A single clock for the whole board, so every ticket agrees to the second. */
  now: number;
  thresholds: KitchenThresholds;
  busy: boolean;
  onAdvance: (order: KitchenOrder, to: KitchenStage, prepMinutes?: number) => void;
  onPrint: (order: KitchenOrder) => void;
}

/**
 * One ticket on the pass.
 *
 * Elapsed time is the loudest thing on the card after the items, and it escalates
 * through weight, a growing left rule and a written flag — never through a red or
 * green light. The thresholds behind it belong to this device (Settings).
 */
export function KitchenTicket({ order, now, thresholds, busy, onAdvance, onPrint }: KitchenTicketProps) {
  const [prepMinutes, setPrepMinutes] = useState<number | null>(null);
  const seconds = elapsedSeconds(order, now);
  const minutes = seconds / 60;
  const urgency = urgencyFor(minutes, thresholds);
  const overEstimate =
    order.prepMinutes !== null && minutes > order.prepMinutes
      ? Math.round(minutes - order.prepMinutes)
      : null;

  const action =
    order.stage === 'new'
      ? { label: 'Start preparing', to: 'preparing' as KitchenStage }
      : order.stage === 'preparing'
        ? { label: 'Mark ready', to: 'ready' as KitchenStage }
        : null;

  return (
    <article
      className="kds-ticket"
      data-urgency={urgency}
      data-busy={busy ? 'true' : 'false'}
      aria-busy={busy}
    >
      <div className="kds-ticket__head">
        <div className="min-w-0">
          <p className="kds-ticket__id">#{order.shortId}</p>
          {order.customerName ? <p className="kds-ticket__customer">{order.customerName}</p> : null}
        </div>
        <div className="kds-ticket__chips">
          {order.tableLabel ? <span className="kds-chip kds-chip--table">{order.tableLabel}</span> : null}
          <span className="kds-chip">{FULFILMENT_LABEL[order.fulfilment]}</span>
        </div>
      </div>

      {order.notes ? (
        <p className="kds-ticket__notes">
          <span>Customer note</span>
          {order.notes}
        </p>
      ) : null}

      <ul className="kds-ticket__items">
        {order.items.length === 0 ? (
          <li>
            <span className="kds-ticket__qty">—</span>
            <span>Items could not be read. Open the order from Orders.</span>
          </li>
        ) : (
          order.items.map((line) => (
            <li key={line.id}>
              <span className="kds-ticket__qty">{line.quantity}×</span>
              <span>
                {line.name}
                {line.addons.length > 0 ? (
                  <span className="kds-ticket__addons">
                    {line.addons.map((addon) => addon.name).join(' · ')}
                  </span>
                ) : null}
              </span>
            </li>
          ))
        )}
      </ul>

      <div className="kds-ticket__meta">
        <span className="kds-ticket__elapsed" aria-label={`${Math.round(minutes)} minutes since payment`}>
          {formatElapsed(seconds)}
        </span>
        <span className="kds-ticket__flag">{URGENCY_FLAG[urgency]}</span>
        {order.prepMinutes !== null ? (
          <span className="kds-ticket__fact">
            {overEstimate === null
              ? `Est. ${order.prepMinutes} min`
              : `Est. ${order.prepMinutes} min · ${overEstimate} min over`}
          </span>
        ) : null}
        <span className="kds-ticket__fact">Paid {formatWatTime(order.paidAt)}</span>
        <span className="kds-ticket__fact">
          {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
        </span>
      </div>

      {action ? (
        <>
          {order.stage === 'new' ? (
            <div className="kds-prep" role="group" aria-label="Prep estimate">
              <span className="kds-prep__label">Estimate</span>
              {PREP_CHOICES.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className="kds-prep__chip"
                  aria-pressed={prepMinutes === choice}
                  onClick={() => setPrepMinutes(prepMinutes === choice ? null : choice)}
                >
                  {choice}m
                </button>
              ))}
            </div>
          ) : null}
          <div className="kds-ticket__actions">
            <button
              type="button"
              className="kds-action"
              disabled={busy}
              onClick={() => onAdvance(order, action.to, prepMinutes ?? undefined)}
            >
              {busy ? <Loader2 className="mr-2 inline size-4 animate-spin" aria-hidden="true" /> : null}
              {action.label}
            </button>
            <button
              type="button"
              className="kds-icon-btn"
              onClick={() => onPrint(order)}
              aria-label={`Print ticket ${order.shortId}`}
            >
              <Printer className="size-4" aria-hidden="true" />
            </button>
          </div>
        </>
      ) : (
        <div className="kds-ticket__actions">
          <button
            type="button"
            className="kds-action"
            disabled={busy}
            onClick={() => onAdvance(order, 'preparing')}
          >
            {busy ? <Loader2 className="mr-2 inline size-4 animate-spin" aria-hidden="true" /> : null}
            Move back to preparing
          </button>
          <button
            type="button"
            className="kds-icon-btn"
            onClick={() => onPrint(order)}
            aria-label={`Print ticket ${order.shortId}`}
          >
            <Printer className="size-4" aria-hidden="true" />
          </button>
        </div>
      )}
    </article>
  );
}
