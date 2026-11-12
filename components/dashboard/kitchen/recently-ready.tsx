'use client';

import { ChevronDown, ChevronUp, Printer, RotateCcw } from 'lucide-react';
import type { KitchenOrder } from '@/lib/kitchen/types';
import { formatElapsed } from '@/lib/kitchen/device-settings';
import { formatWatTime } from '@/lib/wat';

export interface RecentlyReadyProps {
  orders: KitchenOrder[];
  now: number;
  open: boolean;
  busyId: string | null;
  onToggle: () => void;
  onRecall: (order: KitchenOrder) => void;
  onPrint: (order: KitchenOrder) => void;
}

/**
 * The pass keeps a short memory. A ticket that left the Ready column is still one
 * tap from going back to Preparing, which is what "recall" is for: the plate went
 * to the wrong table, or the fryer came back up short.
 *
 * Collapsed by default so it never steals height from the columns.
 */
export function RecentlyReady({ orders, now, open, busyId, onToggle, onRecall, onPrint }: RecentlyReadyProps) {
  const count = orders.length;
  return (
    <section className="kds-drawer" aria-label="Recently ready tickets">
      <button
        type="button"
        className="kds-drawer__toggle"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>
          Recently ready
          <span className="kds-column__count" style={{ marginLeft: 8 }}>
            {count}
          </span>
        </span>
        <span className="flex items-center gap-2 text-[11.5px] font-normal text-[var(--kds-ink-4)]">
          {count > 0 ? 'Recall moves a ticket back to Preparing' : 'Nothing has left the pass yet'}
          {open ? <ChevronDown className="size-4" aria-hidden="true" /> : <ChevronUp className="size-4" aria-hidden="true" />}
        </span>
      </button>

      {open ? (
        <div className="kds-drawer__body">
          {count === 0 ? (
            <p className="kds-drawer__empty">
              Nothing to recall. Tickets appear here once they have been ready for a while.
            </p>
          ) : (
            orders.map((order) => {
              const seconds = Math.max(0, Math.round((now - new Date(order.paidAt).getTime()) / 1000));
              return (
                <div key={order.id} className="kds-drawer__row">
                  <span className="kds-ticket__id">#{order.shortId}</span>
                  {order.tableLabel ? <span className="kds-chip kds-chip--table">{order.tableLabel}</span> : null}
                  <span className="text-[var(--kds-ink-4)]">
                    {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'} · paid {formatWatTime(order.paidAt)}
                  </span>
                  <span className="kds-ticket__elapsed" style={{ fontSize: 12.5 }}>
                    {formatElapsed(seconds)}
                  </span>
                  <button
                    type="button"
                    className="kds-btn"
                    disabled={busyId === order.id}
                    onClick={() => onRecall(order)}
                  >
                    <RotateCcw className="size-3.5" aria-hidden="true" />
                    Recall
                  </button>
                  <button
                    type="button"
                    className="kds-icon-btn"
                    style={{ flex: '0 0 34px', width: 34, minHeight: 34 }}
                    onClick={() => onPrint(order)}
                    aria-label={`Print ticket ${order.shortId}`}
                  >
                    <Printer className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </section>
  );
}
