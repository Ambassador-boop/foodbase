import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { z } from 'zod';
import { handleUnexpected } from '@/lib/api/handler';
import { fail, parseBody } from '@/lib/api';

/**
 * The service-fee ladder. Each rung is a basket size and the fee charged at it.
 * Numbers only: this table is read on every order, so a stray string would
 * break pricing rather than fail loudly.
 */
const ServiceFeeBody = z.object({
  tiers: z
    .array(
      z.object({
        tier_value: z.number({ invalid_type_error: 'Missing tier_value or service_fee' }).finite(),
        service_fee: z.number({ invalid_type_error: 'Missing tier_value or service_fee' }).finite(),
      }),
    )
    .min(1, 'Invalid tiers format'),
});

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
    return fail('INTERNAL_SERVER_ERROR', 'Internal server error', 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = await getTokenFromRequest(req);
    if (!token) {
      console.error('[v0] No token provided to service-fee POST');
      return fail('UNAUTHORIZED', 'Unauthorized', 401);
    }

    let user;
    try {
      user = await verifyToken(token);
    } catch (tokenErr) {
      console.error('[v0] Token verification failed in service-fee:', tokenErr);
      return fail('INVALID_TOKEN', 'Invalid token', 401);
    }

    if (!user) {
      console.error('[v0] No user found from token in service-fee');
      return fail('UNAUTHORIZED', 'Unauthorized', 401);
    }

    if (user.role !== 'admin') {
      console.error('[v0] User role is not admin in service-fee:', user.role);
      return fail('FORBIDDEN_ADMIN_ROLE', 'Forbidden - admin role required', 403);
    }

    const parsed = await parseBody(req, ServiceFeeBody, 'Check the fee tiers.');
    if (!parsed.ok) return parsed.response;
    const { tiers } = parsed.data;

    // Delete existing config
    await sql`DELETE FROM service_fee_config`;

    // Insert new tiers
    for (const tier of tiers) {
      await sql`
        INSERT INTO service_fee_config (tier_value, service_fee)
        VALUES (${tier.tier_value}, ${tier.service_fee})
      `;
    }

    return NextResponse.json({ success: true, message: 'Service fee configuration updated' });
  } catch (error) {
    return handleUnexpected(error, { where: 'POST /api/admin/service-fee', request: req });
  }
}
