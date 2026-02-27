import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { generateAlphanumericId } from '@/lib/utils';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      businessSlug,
      customerName,
      email,
      phone,
      address,
      notes,
      items,
      total,
    } = body;

    if (!businessSlug || !customerName || !email || !phone || !address) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get business
    const businessResult = await db.query(
      'SELECT id FROM businesses WHERE slug = $1',
      [businessSlug]
    );

    if (!businessResult.rows || businessResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Business not found' },
        { status: 404 }
      );
    }

    const businessId = businessResult.rows[0].id;
    const orderId = generateAlphanumericId();

    // Create order
    const orderResult = await db.query(
      `INSERT INTO orders 
       (id, business_id, customer_name, email, phone, address, notes, total, payment_status, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, total`,
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
      return NextResponse.json(
        { error: 'Failed to create order' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId,
      total: orderResult.rows[0].total,
    });
  } catch (error) {
    console.error('Order creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create order' },
      { status: 500 }
    );
  }
}
