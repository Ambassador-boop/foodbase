import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateAlphanumericId } from '@/lib/utils';
import { saveOrderServiceFee } from '@/lib/service-fee';
import { sql } from '@vercel/postgres';

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
    const orderId = generateAlphanumericId();

    console.log('[v0] Order API: Creating order', orderId, 'for business', businessId, 'customer:', customerName);

    let orderResult;

    try {
      orderResult = await db.query(
        `INSERT INTO orders 
     (id, business_id, customer_name, customer_email, customer_phone, address, notes, total_amount, service_fee_amount, payment_status, status, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, NOW())
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
          serviceFee || 0,
          'pending',
          'pending',
        ]
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

    // Insert order items
    if (items && Array.isArray(items) && items.length > 0) {
      try {
        for (const item of items) {
          console.log('[v0] Attempting to insert item:', item);

          const itemId = generateAlphanumericId();

          const itemResult = await db.query(
            `INSERT INTO order_items
      (id, order_id, menu_item_id, quantity, item_price, configuration, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      RETURNING id`,
            [
              itemId,
              orderId,
              item.menu_item_id,
              item.quantity || 1,
              item.item_price,
              item.configuration ? JSON.stringify(item.configuration) : null
            ]
          );

          if (itemResult && itemResult.length > 0) {
            console.log('[v0] Item inserted successfully:', itemResult[0].id);
          } else {
            console.error('[v0] Item insert returned no rows');
          }
        }
      } catch (err) {
        console.error('[v0] Order items insert FAILED:', err);
        // Don't fail the entire order creation, just log the error
      }
    }

    // Save service fee data
    if (serviceFee && serviceFee > 0) {
      try {
        await saveOrderServiceFee(orderId, serviceFee, serviceFeeType || 'tiered');
        
        // Ensure admin_revenue record exists, then update it
        try {
          // First try to update existing record
          const updateResult = await sql`
            UPDATE admin_revenue
            SET total_revenue = total_revenue + ${serviceFee},
                available_balance = available_balance + ${serviceFee},
                updated_at = NOW()
            RETURNING id
          `;
          
          // If no record was updated, insert one
          if (updateResult.rows.length === 0) {
            await sql`
              INSERT INTO admin_revenue (total_revenue, withdrawn_amount, available_balance)
              VALUES (${serviceFee}, 0, ${serviceFee})
            `;
          }
        } catch (revenueErr) {
          console.error('[v0] Failed to update admin revenue:', revenueErr);
        }
      } catch (err) {
        console.error('[v0] Failed to save service fee:', err);
        // Don't fail order creation if service fee save fails
      }
    }

    return NextResponse.json({
      success: true,
      orderId,
      total: orderResult[0].total_amount,
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
