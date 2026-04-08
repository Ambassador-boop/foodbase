import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const result = await sql`
      SELECT id, tier_value, service_fee 
      FROM service_fee_config 
      ORDER BY tier_value ASC
    `;
    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch service fee config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { tiers } = await req.json();

    if (!Array.isArray(tiers) || tiers.length === 0) {
      return NextResponse.json({ error: 'Invalid tiers format' }, { status: 400 });
    }

    // Delete existing config
    await sql`DELETE FROM service_fee_config`;

    // Insert new tiers
    for (const tier of tiers) {
      if (!tier.tier_value || tier.service_fee === undefined) {
        return NextResponse.json({ error: 'Missing tier_value or service_fee' }, { status: 400 });
      }

      await sql`
        INSERT INTO service_fee_config (tier_value, service_fee)
        VALUES (${tier.tier_value}, ${tier.service_fee})
      `;
    }

    return NextResponse.json({ success: true, message: 'Service fee configuration updated' });
  } catch (error) {
    console.error('Failed to update service fee config:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
