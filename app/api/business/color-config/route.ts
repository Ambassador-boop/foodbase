import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { verifyToken } from '@/lib/auth';
import { nanoid } from 'nanoid';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || 
                  request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const businessId = request.nextUrl.searchParams.get('businessId');
    const pageType = request.nextUrl.searchParams.get('pageType');

    if (!businessId || !pageType) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Verify business ownership
    const business = await sql.query(
      'SELECT id FROM businesses WHERE id = $1 AND owner_id = $2',
      [businessId, user.userId]
    );

    if (business.rows.length === 0) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    const { rows } = await sql.query(
      'SELECT * FROM color_configurations WHERE business_id = $1 AND page_type = $2',
      [businessId, pageType]
    );

    return NextResponse.json({ config: rows[0] || null });
  } catch (error) {
    console.error('[v0] Color config fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || 
                  request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await verifyToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { businessId, pageType, backgroundColor, textColor, buttonColor, buttonTextColor, headerColor, headerTextColor, accentColor } = body;

    if (!businessId || !pageType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify business ownership
    const business = await sql.query(
      'SELECT id FROM businesses WHERE id = $1 AND owner_id = $2',
      [businessId, user.userId]
    );

    if (business.rows.length === 0) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 });
    }

    // Check if config exists
    const existing = await sql.query(
      'SELECT id FROM color_configurations WHERE business_id = $1 AND page_type = $2',
      [businessId, pageType]
    );

    let result;
    if (existing.rows.length > 0) {
      // Update existing
      result = await sql.query(
        `UPDATE color_configurations 
         SET background_color = $1, text_color = $2, button_color = $3, 
             button_text_color = $4, header_color = $5, header_text_color = $6, 
             accent_color = $7, updated_at = NOW()
         WHERE business_id = $8 AND page_type = $9
         RETURNING *`,
        [backgroundColor, textColor, buttonColor, buttonTextColor, headerColor, headerTextColor, accentColor, businessId, pageType]
      );
    } else {
      // Insert new
      const id = nanoid();
      result = await sql.query(
        `INSERT INTO color_configurations 
         (id, business_id, page_type, background_color, text_color, button_color, 
          button_text_color, header_color, header_text_color, accent_color)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [id, businessId, pageType, backgroundColor, textColor, buttonColor, buttonTextColor, headerColor, headerTextColor, accentColor]
      );
    }

    return NextResponse.json({ config: result.rows[0] });
  } catch (error) {
    console.error('[v0] Color config save error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
