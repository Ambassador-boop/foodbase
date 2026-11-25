import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { sql } from '@/lib/db';
import { nanoid } from 'nanoid';
import { z } from 'zod';
import { fail, parseBody } from '@/lib/api';

/**
 * An account created by an admin.
 *
 * `role` is constrained to the roles the product actually uses; `password_hash`
 * is accepted as sent because this endpoint predates the password helper and is
 * not used to sign anyone in. Both are flagged in the report.
 */
const AdminUserBody = z.object({
  first_name: z.string().trim().min(1, 'Missing required fields').max(60),
  last_name: z.string().trim().min(1, 'Missing required fields').max(60),
  email: z.string().trim().min(1, 'Missing required fields').email('Enter a valid email address').max(320),
  phone: z.string().trim().max(40).nullish(),
  role: z.enum(['admin', 'business_owner', 'customer', 'staff'], {
    errorMap: () => ({ message: 'Missing required fields' }),
  }),
  password_hash: z.string().max(500).nullish(),
});

export async function GET(request: NextRequest) {
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

    const users = await sql.query(
      'SELECT id, first_name, last_name, email, phone, role, is_active, created_at FROM users ORDER BY created_at DESC'
    );

    return NextResponse.json({ users: users || [] });
  } catch (error) {
    console.error('Error fetching users:', error);
    return fail('INTERNAL_SERVER_ERROR', 'Internal Server Error', 500);
  }
}

export async function POST(request: NextRequest) {
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

    const parsed = await parseBody(request, AdminUserBody, 'Check the account details.');
    if (!parsed.ok) return parsed.response;
    const { first_name, last_name, email, phone, role: userRole, password_hash } = parsed.data;

    const userId = `usr_${nanoid(14)}`;

    await sql.query(
      'INSERT INTO users (id, first_name, last_name, email, phone, role, password_hash, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())',
      [userId, first_name, last_name, email, phone || null, userRole, password_hash || null, true]
    );

    const user = await sql.query(
      'SELECT id, first_name, last_name, email, phone, role, is_active, created_at FROM users WHERE id = $1',
      [userId]
    );

    return NextResponse.json({ user: user[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return fail('INTERNAL_SERVER_ERROR', 'Internal Server Error', 500);
  }
}
