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

    // Check if query returned any rows
    if (!businessRows || businessRows.length === 0) {
      console.log('[v0] Order API: Business not found for ID:', cleanBusinessId);
      return NextResponse.json(
        { error: `Business not found` },
        { status: 404 }
      );
    }

    console.log('[v0] Order API: Business query result:', businessRows[0]);
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
