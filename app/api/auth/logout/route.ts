import { NextResponse } from 'next/server';
import { ACTIVE_BUSINESS_COOKIE } from '@/lib/active-business';

export async function POST() {
  const response = NextResponse.json({ message: 'Logged out successfully' });
  response.cookies.set('auth_token', '', { maxAge: 0 });
  response.cookies.set(ACTIVE_BUSINESS_COOKIE, '', { maxAge: 0 });
  return response;
}
