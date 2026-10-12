import { NextResponse } from 'next/server';

export function GET() { return NextResponse.json({ error: 'This endpoint has been retired' }, { status: 410 }); }
export function POST() { return NextResponse.json({ error: 'This endpoint has been retired' }, { status: 410 }); }
