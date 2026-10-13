import { NextResponse } from 'next/server';
export const GET = () => NextResponse.json({ error: 'This endpoint has been retired' }, { status: 410 });
