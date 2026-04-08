import { sql } from '@vercel/postgres';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await verifyToken(token);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await sql`
      SELECT 
        id,
        amount,
        bank_code,
        account_number,
        account_name,
        paystack_transfer_id,
        status,
        created_at,
        updated_at
      FROM admin_withdrawals
      ORDER BY created_at DESC
    `;

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error('Failed to fetch withdrawals:', error);
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

    const { amount, bank_code, account_number, account_name, paystack_transfer_id } = await req.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid withdrawal amount' }, { status: 400 });
    }

    if (!bank_code || !account_number || !account_name) {
      return NextResponse.json({ error: 'Missing bank details' }, { status: 400 });
    }

    // Check available balance
    const revenueResult = await sql`
      SELECT available_balance FROM admin_revenue LIMIT 1
    `;

    const availableBalance = revenueResult.rows[0]?.available_balance || 0;

    if (amount > availableBalance) {
      return NextResponse.json(
        { error: 'Insufficient balance for withdrawal' },
        { status: 400 }
      );
    }

    // Create withdrawal record
    const withdrawalResult = await sql`
      INSERT INTO admin_withdrawals (amount, bank_code, account_number, account_name, paystack_transfer_id, status)
      VALUES (${amount}, ${bank_code}, ${account_number}, ${account_name}, ${paystack_transfer_id || null}, 'pending')
      RETURNING id, amount, status, created_at
    `;

    // Update available balance (deduct withdrawal amount)
    await sql`
      UPDATE admin_revenue
      SET available_balance = available_balance - ${amount},
          withdrawn_amount = withdrawn_amount + ${amount}
      WHERE id = (SELECT id FROM admin_revenue LIMIT 1)
    `;

    return NextResponse.json(withdrawalResult.rows[0]);
  } catch (error) {
    console.error('Failed to create withdrawal:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
