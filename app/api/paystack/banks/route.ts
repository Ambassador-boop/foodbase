import { NextRequest, NextResponse } from 'next/server';

const PAYSTACK_API_KEY = process.env.PAYSTACK_SECRET_KEY;

export async function GET(request: NextRequest) {
  try {
    if (!PAYSTACK_API_KEY) {
      return NextResponse.json(
        { error: 'Paystack API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch('https://api.paystack.co/bank?currency=NGN', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_API_KEY}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[v0] Paystack banks error:', data);
      return NextResponse.json(
        { error: 'Failed to fetch banks' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      banks: data.data || [],
    });
  } catch (error) {
    console.error('[v0] Get banks error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch banks' },
      { status: 500 }
    );
  }
}
