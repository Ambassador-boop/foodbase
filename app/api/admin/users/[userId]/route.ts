import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { sql } from '@/lib/db';
import { parseBody, parseParams, fail } from '@/lib/api';
import { handleUnexpected } from '@/lib/api/handler';

/** A user id from the URL. */
const UserIdParam = z.object({
  userId: z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/, 'That user reference is not valid.'),
});

/**
 * An admin editing an account.
 *
 * `role` and `is_active` are the two fields that change what a person can do, so
 * both are constrained here rather than passed through: a role that the product
 * does not know, or a string where a boolean belongs, would leave an account in
 * a state the rest of the app does not handle.
 */
const AdminUserUpdateBody = z.object({
  first_name: z.string().trim().min(1, 'Missing required fields').max(60),
  last_name: z.string().trim().min(1, 'Missing required fields').max(60),
  email: z.string().trim().min(1, 'Missing required fields').email('Enter a valid email address').max(320),
  phone: z.string().trim().max(40).nullish(),
  role: z.enum(['admin', 'business_owner', 'customer', 'staff'], {
    errorMap: () => ({ message: 'Missing required fields' }),
  }),
  is_active: z.boolean({ invalid_type_error: 'Missing required fields' }),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const token = await getTokenFromRequest(request);

    if (!token) {
      return fail('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const verified = await verifyToken(token);
    const role = verified?.role as string;

    if (role !== 'admin') {
      return fail('FORBIDDEN', 'Forbidden', 403);
    }

    const parsedParams = parseParams(await params, UserIdParam);
    if (!parsedParams.ok) return parsedParams.response;
    const { userId } = parsedParams.data;

    const user = await sql.query(
      'SELECT id, first_name, last_name, email, phone, role, is_active, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (!user || user.length === 0) {
      return fail('USER_NOT_FOUND', 'User not found', 404);
    }

    return NextResponse.json({ user: user[0] });
  } catch (error) {
    return handleUnexpected(error, { where: 'GET /api/admin/users/[userId]', request });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const token = await getTokenFromRequest(request);

    if (!token) {
      return fail('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const verified = await verifyToken(token);
    const role = verified?.role as string;

    if (role !== 'admin') {
      return fail('FORBIDDEN', 'Forbidden', 403);
    }

    const parsed = await parseBody(request, AdminUserUpdateBody, 'Check the account details.');
    if (!parsed.ok) return parsed.response;
    const { first_name, last_name, email, phone, role: userRole, is_active } = parsed.data;

    const parsedParams = parseParams(await params, UserIdParam);
    if (!parsedParams.ok) return parsedParams.response;
    const { userId } = parsedParams.data;
    await sql.query(
      'UPDATE users SET first_name = $1, last_name = $2, email = $3, phone = $4, role = $5, is_active = $6, updated_at = NOW() WHERE id = $7',
      [first_name, last_name, email, phone || null, userRole, is_active, userId]
    );

    const user = await sql.query(
      'SELECT id, first_name, last_name, email, phone, role, is_active, created_at FROM users WHERE id = $1',
      [userId]
    );

    return NextResponse.json({ user: user[0] });
  } catch (error) {
    return handleUnexpected(error, { where: 'PUT /api/admin/users/[userId]', request });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const token = await getTokenFromRequest(request);

    if (!token) {
      return fail('UNAUTHORIZED', 'Unauthorized', 401);
    }

    const verified = await verifyToken(token);
    const role = verified?.role as string;

    if (role !== 'admin') {
      return fail('FORBIDDEN', 'Forbidden', 403);
    }

    const { userId } = await params;
    await sql.query('DELETE FROM users WHERE id = $1', [userId]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
