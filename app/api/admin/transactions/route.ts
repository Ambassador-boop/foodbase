import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@vercel/postgres';
import { getTokenFromRequest, verifyToken } from '@/lib/auth';

const rowsOf = (value: { rows?: unknown[] }) => value.rows ?? [];

export async function GET(request: NextRequest) {
  try {
    const token = await getTokenFromRequest(request);
    const user = token ? await verifyToken(token) : null;
    if (!user || user.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const params = request.nextUrl.searchParams;
    const page = Math.max(1, Number(params.get('page') || 1));
    const limit = Math.min(25, Math.max(1, Number(params.get('limit') || 25)));
    const search = (params.get('search') || '').trim().toLowerCase();
    const status = (params.get('status') || 'all').toLowerCase();
    const range = params.get('range') || '30d';

    const result = await sql`
      SELECT osf.id, osf.order_id, osf.service_fee_amount, osf.created_at,
        o.total_amount, o.customer_name, o.customer_email,
        o.status, o.payment_status, b.name AS business_name
      FROM order_service_fees osf
      JOIN orders o ON o.id = osf.order_id
      JOIN businesses b ON b.id = o.business_id
      ORDER BY osf.created_at DESC
    `;

    const now = Date.now();
    const rangeMs: Record<string, number> = { '7d': 7, '30d': 30, month: 31, today: 1 };
    const days = rangeMs[range];
    const filtered = rowsOf(result).filter((row: any) => {
      const haystack = `${row.business_name || ''} ${row.customer_name || ''} ${row.customer_email || ''} ${row.order_id || ''}`.toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      const normalizedStatus = String(row.payment_status || row.status || '').toLowerCase();
      const matchesStatus = status === 'all' || normalizedStatus === status;
      const matchesRange = !days || now - new Date(row.created_at).getTime() <= days * 86400000;
      return matchesSearch && matchesStatus && matchesRange;
    });
    const start = (page - 1) * limit;
    const transactions = filtered.slice(start, start + limit).map((row: any) => ({
      ...row,
      total: row.total_amount,
      net_received: Number(row.total_amount || 0) - Number(row.service_fee_amount || 0),
    }));

    return NextResponse.json({ transactions, pagination: { page, limit, total: filtered.length, hasMore: start + limit < filtered.length } });
  } catch (error) {
    console.error('[v0] admin transactions list failed', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
