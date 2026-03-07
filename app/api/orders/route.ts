import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateAlphanumericId } from '@/lib/utils';

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
      deliveryFee,
      total,
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

    if (!businessId || !customerName || !email || !phone || !address) {
      console.log('[v0] Order API: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify business exists
    // Sanitize businessId
    const cleanBusinessId = businessId.trim();

    // Verify business exists
    // Verify business exists
    const businessRows = await db.query(
      'SELECT id FROM public.businesses WHERE id = $1',
      [cleanBusinessId]
    );

    if (!businessRows.rows || businessRows.rows.length === 0) {
      console.log('[v0] Order API: Business not found for ID:', cleanBusinessId);
      return NextResponse.json(
        { error: `Business not found` },
        { status: 404 }
      );
    }

    console.log('[v0] Order API: Business query result:', businessRows.rows[0]);
    const orderId = generateAlphanumericId();

    console.log('[v0] Order API: Creating order', orderId, 'for business', businessId, 'customer:', customerName);

    // Create order
    const orderResult = await db.query(
      `INSERT INTO orders 
       (id, business_id, customer_name, customer_email, customer_phone, address, notes, total_amount, payment_status, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, total_amount`,
      [
        orderId,
        businessId,
        customerName,
        email,
        phone,
        address,
        notes || null,
        total,
        'pending',
        'pending',
      ]
    );

    if (!orderResult.rows || orderResult.rows.length === 0) {
      console.log('[v0] Order API: Failed to insert order');
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: 500 }
      );
    }

    console.log('[v0] Order API: Order created successfully with total:', orderResult.rows[0].total_amount);

    console.log('[v0] Items received from checkout:', items);

    // Insert order items
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        try {
          console.log('[v0] Attempting to insert item:', item);

          const itemId = generateAlphanumericId();

          await db.query(
            `INSERT INTO order_items
      (id, order_id, menu_item_id, quantity, item_price, configuration)
      VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              itemId,
              orderId,
              item.menu_item_id,
              item.quantity || 1,
              item.item_price,
              item.configuration || null
            ]
          );

          console.log('[v0] Item inserted successfully');

        } catch (err) {
          console.error('[v0] Item insert FAILED:', err);
        }
      }
    }


    return NextResponse.json({
      success: true,
      orderId,
      total: orderResult.rows[0].total_amount,
      reference: orderId,
    });
  } catch (error) {
    console.error('[v0] Order creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
