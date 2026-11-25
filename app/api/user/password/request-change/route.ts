import { NextResponse } from 'next/server';
import { fail } from '@/lib/api';
export async function POST(){return fail('THIS_ENDPOINT_BEEN', 'This endpoint has been retired', 410)}
