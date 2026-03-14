import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { sql } from '@/lib/db';

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

    // Get total businesses
    const businessesResult = await sql.query('SELECT COUNT(*) as count FROM businesses WHERE is_active = true');
    const totalBusinesses = businessesResult[0]?.count || 0;

    // Get total orders
    const ordersResult = await sql.query('SELECT COUNT(*) as count FROM orders');
    const totalOrders = ordersResult[0]?.count || 0;

    // Get total revenue from transactions
    const revenueResult = await sql.query('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE status = \'completed\'');
    const totalRevenue = revenueResult[0]?.total || 0;

    // Get total users
    const usersResult = await sql.query('SELECT COUNT(*) as count FROM users');
    const totalUsers = usersResult[0]?.count || 0;

    return NextResponse.json({
      totalBusinesses: Number(totalBusinesses),
      totalOrders: Number(totalOrders),
      totalRevenue: Number(totalRevenue),
      totalUsers: Number(totalUsers),
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
