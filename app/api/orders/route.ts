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
      subtotal,
      serviceFee,
      deliveryFee,
      total,
    } = body;

    console.log('[v0] Order API: Creating order with fields:', {
      businessSlug,
      businessSlugType: typeof businessSlug,
      customerName,
      phone,
      subtotal,
      serviceFee,
      deliveryFee,
      total,
    });

    if (!businessSlug || !customerName || !email || !phone || !address) {
      console.log('[v0] Order API: Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get business (case-insensitive slug lookup) - trim whitespace
    const trimmedSlug = businessSlug.trim().toLowerCase();
    console.log('[v0] Order API: Trimmed slug:', trimmedSlug);
    
    const businessResult = await db.query(
      'SELECT id FROM businesses WHERE LOWER(TRIM(slug)) = $1',
      [trimmedSlug]
    );

    if (!businessResult.rows || businessResult.rows.length === 0) {
      console.log('[v0] Order API: Business not found for slug:', businessSlug, 'trimmed:', trimmedSlug);
      console.log('[v0] Order API: Attempting to debug - checking all businesses');
      // Debug: Try to find all businesses with similar slugs
      const allBusinesses = await db.query('SELECT id, slug FROM businesses', []);
      console.log('[v0] Order API: Total businesses in DB:', allBusinesses.rows?.length || 0);
      if (allBusinesses.rows && allBusinesses.rows.length > 0) {
        console.log('[v0] Order API: Sample businesses:', allBusinesses.rows.slice(0, 3));
      }
      return NextResponse.json(
        { error: `Business not found for slug: ${businessSlug}` },
        { status: 404 }
      );
    }

    const businessId = businessResult.rows[0].id;
    const orderId = generateAlphanumericId();

    console.log('[v0] Order API: Creating order', orderId, 'for business', businessId);

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
