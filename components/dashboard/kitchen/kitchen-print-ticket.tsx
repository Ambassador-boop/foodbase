'use client';

import type { KitchenOrder } from '@/lib/kitchen/types';
import { money } from '@/components/dashboard/tokens';
import { formatWatTime } from '@/lib/wat';

const FULFILMENT_LABEL: Record<KitchenOrder['fulfilment'], string> = {
  delivery: 'Delivery',
  dine_in: 'Dine in',
  pickup: 'Pickup',
};

/**
 * The 80mm ticket. It is a separate tree from the board on purpose: `@media print`
 * hides the board and shows this, so what comes out of a thermal printer is
 * exactly the ticket and nothing else. No browser chrome, no other tickets, no
 * dark theme.
 */
export function KitchenPrintTicket({
  order,
  businessName,
  printedAt,
}: {
  order: KitchenOrder;
  businessName: string;
  printedAt: Date;
}) {
  return (
    <div className="kds-print" aria-hidden="true">
      <h1>{businessName}</h1>
      <p className="kds-print__kind">Kitchen ticket</p>
      <p className="kds-print__id">#{order.shortId}</p>
      <div className="kds-print__row">
        <span>{FULFILMENT_LABEL[order.fulfilment]}</span>
        {order.tableLabel ? <span>{order.tableLabel}</span> : null}
      </div>
      <div className="kds-print__row">
        <span>Paid</span>
        <span>{formatWatTime(order.paidAt)}</span>
      </div>
      {order.customerName ? (
        <div className="kds-print__row">
          <span>Customer</span>
          <span>{order.customerName}</span>
        </div>
      ) : null}
      <hr />
      {order.items.map((line) => (
        <div key={line.id}>
          <div className="kds-print__item">
            <span className="kds-print__qty">{line.quantity}×</span>
            <span>{line.name}</span>
          </div>
          {line.addons.length > 0 ? (
            <div className="kds-print__addons">{line.addons.map((addon) => addon.name).join(', ')}</div>
          ) : null}
        </div>
      ))}
      {order.notes ? <p className="kds-print__notes">NOTE: {order.notes}</p> : null}
      <hr />
      <div className="kds-print__row">
        <span>
          {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
        </span>
        <span>{money(order.total)}</span>
      </div>
      {order.prepMinutes !== null ? (
        <div className="kds-print__row">
          <span>Prep estimate</span>
          <span>{order.prepMinutes} min</span>
        </div>
      ) : null}
      <p className="kds-print__foot">Printed {formatWatTime(printedAt.toISOString())}</p>
    </div>
  );
}
