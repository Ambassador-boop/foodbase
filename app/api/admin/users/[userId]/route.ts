import { NextRequest, NextResponse } from 'next/server';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const token = await getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await verifyToken(token);
    const role = verified?.role as string;

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { userId } = await params;
    const user = await sql.query(
      'SELECT id, first_name, last_name, email, phone, role, is_active, created_at FROM users WHERE id = $1',
      [userId]
    );

    if (!user || user.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ user: user[0] });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const token = await getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await verifyToken(token);
    const role = verified?.role as string;

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { first_name, last_name, email, phone, role: userRole, is_active } = await request.json();

    if (!first_name || !last_name || !email || userRole === undefined || is_active === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const { userId } = await params;
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
    console.error('Error updating user:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const token = await getTokenFromRequest(request);

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const verified = await verifyToken(token);
    const role = verified?.role as string;

    if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
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
