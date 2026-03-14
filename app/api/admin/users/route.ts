import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { db } from '@/lib/db';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'secret');

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await jwtVerify(token, secret);
    const role = verified.payload.role as string;

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const users = await db(
      'SELECT id, first_name, last_name, email, phone, role, is_active, created_at FROM users ORDER BY created_at DESC'
    );

    return NextResponse.json({ users: users || [] });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await jwtVerify(token, secret);
    const role = verified.payload.role as string;

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { first_name, last_name, email, phone, role: userRole, password_hash } = await request.json();

    if (!first_name || !last_name || !email || !userRole) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const userId = `user_${Date.now()}`;

    await db(
      'INSERT INTO users (id, first_name, last_name, email, phone, role, password_hash, is_active, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())',
      [userId, first_name, last_name, email, phone || null, userRole, password_hash || null, true]
    );

    const user = await db(
      'SELECT id, first_name, last_name, email, phone, role, is_active, created_at FROM users WHERE id = $1',
      [userId]
    );

    return NextResponse.json({ user: user[0] }, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
