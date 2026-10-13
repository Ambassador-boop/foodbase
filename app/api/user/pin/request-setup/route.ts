import { NextResponse } from 'next/server';
export const POST = () => NextResponse.json({ error: 'This endpoint has been retired' }, { status: 410 });
