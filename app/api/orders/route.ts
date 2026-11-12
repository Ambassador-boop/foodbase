import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getOne } from '@/lib/db';
import { generateAlphanumericId } from '@/lib/utils';
import {
  getServiceFeeConfig,
  calculateServiceFee,
  saveOrderServiceFee,
} from '@/lib/service-fee';
import { DRINK_ID_PREFIX, round2 } from '@/lib/pricing';
import { getOrderingStatus } from '@/lib/business-hours';
import { resolveDelivery } from '@/lib/delivery/pricing';
import {
  activeLabels,
  getSchemaSupport,
  loadTableLabels,
} from '@/lib/delivery/storage';

/**
 * Order creation endpoint.
 *
 * Batch 2b: every amount is now calculated here, from the database. The
 * numbers the browser sends (item_price, subtotal, serviceFee, deliveryFee,
 * total) are never stored and never charged: they are only compared against
 * the server's own calculation so a tampered cart gets a 409 instead of a
 * cheap order (the total is what /api/payments/initialize charges).
 */

const MIN_QUANTITY = 1;
const MAX_QUANTITY = 99;
/** Tolerated difference between the client total and the server total, in Naira. */
const PRICE_MISMATCH_TOLERANCE = 1;

interface ResolvedAddon {
  id: string;
  name: string;
  price: number;
}

interface ResolvedLine {
  /** The id exactly as the browser sent it (menu id, or `drink_<id>`). */
  clientId: string;
  /** The id stored in order_items.menu_item_id (drink prefix stripped). */
  menuItemId: string;
  itemType: 'menu' | 'drink';
  name: string;
  quantity: number;
  basePrice: number;
  addons: ResolvedAddon[];
  lineTotal: number;
  /** The untouched client `configuration` value, used only to keep the stored shape. */
  rawConfiguration: unknown;
}

/** Small JSON response helper so every 400 looks the same. */
function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

/**
 * Pull the add-on entries out of the client `configuration` value.
 *
 * The checkout page sends an array with one entry per selected unit. Older
 * payloads may send null, an empty array, or a legacy marker object that
 * carries no add-ons at all - all of those simply mean "no add-ons".
 */
function readConfigurationEntries(configuration: unknown): any[] {
  if (Array.isArray(configuration)) return configuration;
  if (configuration && typeof configuration === 'object') {
    const nested = (configuration as { addons?: unknown }).addons;
    if (Array.isArray(nested)) return nested;
  }
  return [];
}

/**
 * Re-price the add-ons of one line from the database.
 *
 * `addon_options.id` is what the storefront puts in the cart (see
 * app/[slug]/add-on/page.tsx), so that is what we resolve against. Every
 * option must belong to an add-on that is linked to this menu item through
 * menu_item_addons; prices always come from addon_options.price.
 */
async function resolveAddons(
  configuration: unknown,
  context: { businessId: string; menuItemId: string; itemType: 'menu' | 'drink'; itemName: string },
): Promise<ResolvedAddon[]> {
  const entries = readConfigurationEntries(configuration);
  if (entries.length === 0) return [];

  const ids: string[] = [];
  for (const entry of entries) {
    const id = typeof entry?.id === 'string' ? entry.id.trim() : '';
    if (!id) {
      return Promise.reject(
        new Error(`An add-on on "${context.itemName}" is missing its id. Please review your cart.`),
      );
    }
    ids.push(id);
  }

  // One query for every distinct option id on the line.
  const uniqueIds = Array.from(new Set(ids));
  const optionPlaceholders = uniqueIds.map((_, index) => `$${index + 1}`).join(', ');
  const optionRows = await db.query(
    `SELECT ao.id, ao.name, ao.price, ao.addon_id
       FROM addon_options ao
      WHERE ao.id IN (${optionPlaceholders})`,
    uniqueIds,
  );
  const options = new Map<string, any>();
  for (const row of (optionRows || []) as any[]) {
    options.set(String(row.id), row);
  }

  // Add-ons are only valid when they are attached to this menu item.
  // Drinks have no menu_item_addons rows, so any add-on on a drink is invalid.
  let linkedAddonIds = new Set<string>();
  if (context.itemType === 'menu') {
    const linkRows = await db.query(
      'SELECT addon_id FROM menu_item_addons WHERE menu_item_id = $1',
      [context.menuItemId],
    );
    linkedAddonIds = new Set(
      ((linkRows || []) as any[]).map((row) => String(row.addon_id)),
    );
  }

  const resolved: ResolvedAddon[] = [];
  for (const id of ids) {
    const option = options.get(id);
    if (!option) {
      return Promise.reject(
        new Error(`An item in your cart is no longer available: an add-on on "${context.itemName}".`),
      );
    }
    if (!linkedAddonIds.has(String(option.addon_id))) {
      return Promise.reject(
        new Error(`An add-on on "${context.itemName}" is no longer available.`),
      );
    }
    resolved.push({
      id: String(option.id),
      name: String(option.name ?? ''),
      price: round2(Number(option.price) || 0),
      // addon_options has no image_url column. The key is left out on purpose so
      // the stored shape stays the same as the client's ({id,name,price,image_url}
      // with image_url dropped by JSON.stringify when undefined).
    } as ResolvedAddon);
  }

  return resolved;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      businessId,
      customerName,
      email,
      phone,
      address,
      notes,
      items,
      subtotal,
      serviceFee,
      serviceFeeType,
      deliveryFee,
      total,
      tableLabel,
      deliveryLat,
      deliveryLng,
      deliveryAddressText,
    } = body;

    console.log('[v0] Order API: Creating order with fields:', {
      businessId,
      customerName,
      phone,
      subtotal,
      serviceFee,
      deliveryFee,
      total,
    });

    if (!businessId) {
      console.log('[v0] Order API: Missing businessId');
      return NextResponse.json(
        { error: 'Business ID is required' },
        { status: 400 }
      );
    }

    if (!customerName || !email || !phone || !address) {
      console.log('[v0] Order API: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields: name, email, phone, and address are required' },
        { status: 400 }
      );
    }

    // Verify business exists
    const cleanBusinessId = String(businessId).trim();
    console.log('[v0] Order API: Verifying business with ID:', cleanBusinessId);

    let businessRows;
    try {
      businessRows = await db.query(
        'SELECT id, name FROM public.businesses WHERE id = $1',
        [cleanBusinessId]
      );
    } catch (err) {
      console.error('[v0] Order API: Database query error:', err);
      return NextResponse.json(
        { error: 'Database error while verifying business' },
        { status: 500 }
      );
    }

    if (!businessRows || businessRows.length === 0) {
      console.log('[v0] Order API: Business not found for ID:', cleanBusinessId);
      console.log('[v0] Order API: Query returned:', businessRows);
      return NextResponse.json(
        { error: 'Business not found. Please check your restaurant link.' },
        { status: 404 }
      );
    }

    console.log('[v0] Order API: Business verified:', businessRows[0].name);

    // ------------------------------------------------------------------
    // Opening hours (Batch 3A-fix).
    //
    // This is the only place the "accept orders outside opening hours"
    // setting is enforced. It runs after the business is verified and
    // before a single price is read or a row is written, so a closed
    // restaurant can never reach pricing, order_items or payment.
    //
    // Missing data never blocks: getOrderingStatus answers "allowed" when
    // the schedule is empty, the additive columns are absent, or the
    // lookup itself fails. With the setting on (the default) nothing here
    // changes behaviour at all.
    // ------------------------------------------------------------------
    try {
      const ordering = await getOrderingStatus(cleanBusinessId);
      if (!ordering.allowed) {
        console.log('[v0] Order API: Refusing order, restaurant is closed', {
          businessId: cleanBusinessId,
          opensAt: ordering.opensAt,
        });
        return NextResponse.json(
          {
            error: 'This restaurant is not taking orders right now.',
            code: 'RESTAURANT_CLOSED',
            opensAt: ordering.opensAt,
          },
          { status: 409 }
        );
      }
    } catch (hoursError) {
      // An hours problem must never cost a customer their order.
      console.warn('[v0] Order API: Hours check failed, allowing the order', hoursError);
    }

    // ------------------------------------------------------------------
    // Server-side re-pricing. Nothing below trusts a number from the browser.
    // ------------------------------------------------------------------

    if (!Array.isArray(items) || items.length === 0) {
      console.log('[v0] Order API: Missing or empty items array');
      return badRequest('Your cart is empty. Please add an item and try again.');
    }

    // Anything that is not exactly 'delivery' is treated as eating at the restaurant.
    const requestedDeliveryType = body.deliveryType;
    const deliveryType = requestedDeliveryType === 'delivery' ? 'delivery' : 'restaurant';

    const resolvedItems: ResolvedLine[] = [];

    for (const rawItem of items as any[]) {
      const quantity = Number(rawItem?.quantity);
      if (!Number.isInteger(quantity) || quantity < MIN_QUANTITY || quantity > MAX_QUANTITY) {
        console.log('[v0] Order API: Invalid quantity:', rawItem?.quantity);
        return badRequest(
          `Each item needs a whole-number quantity between ${MIN_QUANTITY} and ${MAX_QUANTITY}.`,
        );
      }

      const rawId = typeof rawItem?.menu_item_id === 'string' ? rawItem.menu_item_id.trim() : '';
      if (!rawId) {
        console.log('[v0] Order API: Item missing menu_item_id:', rawItem);
        return badRequest('An item in your cart is missing its id. Please review your cart.');
      }

      const isDrink = rawId.startsWith(DRINK_ID_PREFIX);
      const databaseId = isDrink ? rawId.substring(DRINK_ID_PREFIX.length) : rawId;
      const itemType: 'menu' | 'drink' = isDrink ? 'drink' : 'menu';

      if (!databaseId) {
        return badRequest('An item in your cart is missing its id. Please review your cart.');
      }

      // Load the real row: it must exist, belong to this business, and be available.
      const table = isDrink ? 'drinks' : 'menu_items';
      const priceRows = await db.query(
        `SELECT id, name, price FROM ${table}
          WHERE id = $1 AND business_id = $2 AND is_available = true`,
        [databaseId, cleanBusinessId],
      );

      if (!priceRows || priceRows.length === 0) {
        console.log('[v0] Order API: Item unavailable or not owned by business:', rawId);
        return badRequest(
          `An item in your cart is no longer available (${rawId}). Please review your cart.`,
        );
      }

      const priceRow = priceRows[0] as any;
      const itemName = String(priceRow.name ?? rawId);
      // menu_items.price is ALREADY the final price after any discount;
      // original_price is only used for the strike-through display.
      const basePrice = round2(Number(priceRow.price) || 0);

      let addons: ResolvedAddon[] = [];
      try {
        addons = await resolveAddons(rawItem?.configuration, {
          businessId: cleanBusinessId,
          menuItemId: databaseId,
          itemType,
          itemName,
        });
      } catch (err) {
        console.log('[v0] Order API: Add-on validation failed:', err);
        return badRequest(
          err instanceof Error
            ? err.message
            : 'An add-on in your cart is no longer available. Please review your cart.',
        );
      }

      const addonsPerUnit = addons.reduce((sum, addon) => sum + addon.price, 0);
      const lineTotal = round2((basePrice + addonsPerUnit) * quantity);

      resolvedItems.push({
        clientId: rawId,
        menuItemId: databaseId,
        itemType,
        name: itemName,
        quantity,
        basePrice,
        addons,
        lineTotal,
        rawConfiguration: rawItem?.configuration,
      });

      console.log('[v0] Order API: Re-priced line', {
        id: rawId,
        type: itemType,
        quantity,
        basePrice,
        addonsPerUnit,
        lineTotal,
      });
    }

    const serverSubtotal = round2(
      resolvedItems.reduce((sum, line) => sum + line.lineTotal, 0),
    );

    // Service fee: computed here from the live tiers, ignoring body.serviceFee /
    // body.serviceFeeType for the value. The stored type stays 'tiered'.
    const serviceFeeConfig = await getServiceFeeConfig();
    const serverServiceFee = round2(calculateServiceFee(serverSubtotal, serviceFeeConfig));

    // ------------------------------------------------------------------
    // Delivery (Batch 3B).
    //
    // The fee is resolved here from coordinates, never from the browser.
    // `body.deliveryFee` is read above only so the client's number can be
    // compared for the mismatch check; it is never charged and never stored.
    //
    // With the delivery tables migrated and no active area, delivery is free.
    // With the tables absent, this falls back to the legacy flat fee so today's
    // pricing is untouched until the SQL has been run.
    // ------------------------------------------------------------------
    // `Number(null)` is 0, and (0, 0) is in the Gulf of Guinea: a missing
    // coordinate must never become a real-looking point.
    const latValue = typeof deliveryLat === 'number' || typeof deliveryLat === 'string' ? Number(deliveryLat) : NaN;
    const lngValue = typeof deliveryLng === 'number' || typeof deliveryLng === 'string' ? Number(deliveryLng) : NaN;
    const resolvedPoint =
      Number.isFinite(latValue) && Number.isFinite(lngValue) && !(latValue === 0 && lngValue === 0)
        ? { lat: latValue, lng: lngValue }
        : null;

    const delivery = await resolveDelivery({
      businessId: cleanBusinessId,
      deliveryType,
      point: resolvedPoint,
      subtotal: serverSubtotal,
    });

    if (!delivery.ok) {
      console.log('[v0] Order API: Delivery refused', {
        code: delivery.code,
        deliveryType,
      });
      return NextResponse.json(
        {
          error: delivery.message,
          code: delivery.code,
          minOrder: delivery.minOrder ?? null,
          remainingForMinimum: delivery.remainingForMinimum ?? null,
        },
        { status: delivery.code === 'OUTSIDE_AREA' ? 422 : 400 },
      );
    }

    const serverDeliveryFee = delivery.fee;

    // ------------------------------------------------------------------
    // Table label (Batch 3B).
    //
    // A dine-in order with labels configured must name a live table. When no
    // labels exist, whatever the client sends is ignored and nothing about the
    // order changes.
    // ------------------------------------------------------------------
    const [support, allLabels] = await Promise.all([getSchemaSupport(), loadTableLabels(cleanBusinessId)]);
    const labels = activeLabels(allLabels);
    let resolvedTableLabel: string | null = null;

    if (deliveryType !== 'delivery' && labels.length > 0) {
      const requested = typeof tableLabel === 'string' ? tableLabel.trim() : '';
      if (!requested) {
        return NextResponse.json(
          {
            error: 'Choose your table so the order reaches the right one.',
            code: 'TABLE_REQUIRED',
            tables: labels.map((label) => label.label),
          },
          { status: 400 },
        );
      }
      const match = labels.find(
        (label) => label.label.trim().toLowerCase() === requested.toLowerCase(),
      );
      if (!match) {
        return NextResponse.json(
          {
            error: 'That table is no longer available. Choose another one.',
            code: 'INVALID_TABLE',
            tables: labels.map((label) => label.label),
          },
          { status: 400 },
        );
      }
      resolvedTableLabel = match.label;
    }

    const serverTotal = round2(serverSubtotal + serverServiceFee + serverDeliveryFee);

    console.log('[v0] Order API: Server pricing', {
      deliveryType,
      serverSubtotal,
      serverServiceFee,
      serverDeliveryFee,
      serverTotal,
      clientTotal: total,
    });

    // The browser's total is used for one thing only: noticing that the cart
    // is stale or was tampered with before we create (and later charge) an order.
    const clientTotal = Number(total);
    if (!Number.isFinite(clientTotal) || Math.abs(clientTotal - serverTotal) > PRICE_MISMATCH_TOLERANCE) {
      console.warn('[v0] Order API: Price mismatch, refusing to create order', {
        clientTotal,
        serverTotal,
      });
      return NextResponse.json(
        {
          error: 'Prices have changed. Please review your cart.',
          code: 'PRICE_MISMATCH',
          subtotal: serverSubtotal,
          serviceFee: serverServiceFee,
          deliveryFee: serverDeliveryFee,
          total: serverTotal,
        },
        { status: 409 },
      );
    }

    const orderId = generateAlphanumericId();

    console.log('[v0] Order API: Creating order', orderId, 'for business', businessId, 'customer:', customerName);

    let orderResult;

    try {
      // Additive columns are written only when the migration has run, so an
      // un-migrated database keeps taking orders exactly as it does today.
      const columns = [
        'id',
        'business_id',
        'customer_name',
        'customer_email',
        'customer_phone',
        'address',
        'notes',
        'total_amount',
        'service_fee_amount',
        'payment_status',
        'status',
      ];
      const allValues: any[] = [
        orderId,
        businessId,
        customerName,
        email,
        phone,
        address,
        notes || null,
        serverTotal,
        serverServiceFee,
        'pending',
        'pending',
      ];

      if (support.orderDelivery) {
        columns.push(
          'delivery_fee',
          'delivery_area_id',
          'delivery_lat',
          'delivery_lng',
          'estimated_delivery_minutes',
          'delivery_address_text',
        );
        allValues.push(
          serverDeliveryFee,
          delivery.area?.id ?? null,
          resolvedPoint?.lat ?? null,
          resolvedPoint?.lng ?? null,
          delivery.estimate?.max ?? null,
          typeof deliveryAddressText === 'string' && deliveryAddressText.trim()
            ? deliveryAddressText.trim().slice(0, 500)
            : null,
        );
      }

      if (support.orderTableLabel) {
        columns.push('table_label');
        allValues.push(resolvedTableLabel);
      }

      columns.push('created_at');
      const placeholders = allValues.map((_, index) => `$${index + 1}`);
      placeholders.push('NOW()');

      orderResult = await db.query(
        `INSERT INTO orders
     (${columns.join(', ')})
     VALUES (${placeholders.join(', ')})
     RETURNING id, total_amount`,
        allValues,
      );
    } catch (err) {
      console.error('[v0] Order insert failed:', err);
      return NextResponse.json(
        { error: 'Database insert failed' },
        { status: 500 }
      );
    }

    if (!orderResult || orderResult.length === 0) {
      console.log('[v0] Order API: Failed to insert order');
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: 500 }
      );
    }

    console.log('[v0] Order API: Order created successfully with total:', orderResult[0].total_amount);

    console.log('[v0] Items received from checkout:', items);

    // Insert order items.
    //
    // All rows go in ONE statement on purpose. lib/db.ts exposes a
    // `transaction()` helper, but it only calls the callback with the same
    // client (no BEGIN/COMMIT), so it gives no atomicity - the Neon HTTP
    // driver cannot hold a transaction open across separate queries. A single
    // multi-row INSERT is atomic in Postgres, so either every line is written
    // or none is, and the order is never left half-created.
    //
    // As before, a failed item insert does not fail the order itself.
    try {
      const insertValues: any[] = [];
      const valueRows: string[] = [];

      for (const line of resolvedItems) {
        // Order_items.item_price holds the SERVER base price only; add-ons stay
        // in `configuration` exactly as they did before (one entry per unit).
        let configuration: any = {};
        if (line.addons.length > 0) {
          configuration = line.addons;
        } else if (line.itemType === 'drink' && !Array.isArray(line.rawConfiguration)) {
          // Unchanged legacy behaviour: when the client sent no configuration at
          // all (rather than an empty array) drinks get this marker so they can
          // still be recognised on retrieval. It carries no prices.
          configuration.item_type = 'drink'; // Mark this as a drink for retrieval
        }

        const configurationJson =
          Object.keys(configuration).length > 0 ? JSON.stringify(configuration) : null;

        const offset = insertValues.length;
        insertValues.push(
          generateAlphanumericId(),
          orderId,
          line.menuItemId,
          line.quantity,
          line.basePrice,
          line.itemType,
          configurationJson,
        );
        valueRows.push(
          `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, NOW())`,
        );
      }

      const itemResult = await db.query(
        `INSERT INTO order_items
      (id, order_id, menu_item_id, quantity, item_price, item_type, configuration, created_at)
      VALUES ${valueRows.join(', ')}
      RETURNING id`,
        insertValues,
      );

      if (itemResult && itemResult.length === resolvedItems.length) {
        console.log('[v0] ✓ Order items inserted:', itemResult.length);
      } else {
        console.error('[v0] ✗ Item insert returned no rows for order:', orderId);
      }
    } catch (err) {
      console.error('[v0] ✗ Order items insert FAILED:', err);
      // Don't fail the entire order creation, just log the error
    }

    // Save service fee record for the order. Admin revenue is NOT credited
    // here — it is credited only after Paystack confirms payment, in the
    // /api/payments/verify (and /api/payments/webhook) handler. This prevents
    // crediting fees for orders that never actually get paid.
    if (serverServiceFee && serverServiceFee > 0) {
      try {
        await saveOrderServiceFee(orderId, serverServiceFee, 'tiered');
      } catch (err) {
        console.error('[v0] Failed to save service fee:', err);
        // Don't fail order creation if service fee save fails
      }
    }

    // Batch 3C: the restaurant is no longer told about an order here, before it has
    // been paid. The paid-order alert fires once at payment confirmation, from
    // /api/payments/verify and /api/payments/webhook (lib/paid-order-notification.ts).
    // `sendNewOrderNotification` itself is untouched and still serves /api/orders/notify.

    return NextResponse.json({
      success: true,
      orderId,
      total: orderResult[0].total_amount,
      reference: orderId,
      // Added in batch 2b: the server's own breakdown, useful for receipts/debugging.
      subtotal: serverSubtotal,
      serviceFee: serverServiceFee,
      deliveryFee: serverDeliveryFee,
      // Added in batch 3b.
      deliveryAreaId: delivery.area?.id ?? null,
      deliveryAreaName: delivery.area?.name ?? null,
      estimatedDeliveryMinutes: delivery.estimate?.max ?? null,
      tableLabel: resolvedTableLabel,
    });
  } catch (error) {
    console.error('[v0] Order creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
