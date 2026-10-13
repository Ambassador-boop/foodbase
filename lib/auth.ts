import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { randomInt } from 'crypto';
import { getOne } from './db';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is not configured');
  return new TextEncoder().encode(secret || 'your-secret-key-change-in-production');
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createJWT(payload: {
  userId: string;
  role: 'admin' | 'business_owner';
  businessId?: string;
}) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(getJwtSecret());

  return token;
}

export async function verifyJWT(token: string) {
  try {
    const verified = await jwtVerify(token, getJwtSecret());
    return verified.payload;
  } catch (error) {
    return null;
  }
}

export async function setAuthCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set('auth_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });
}

export async function getAuthCookie() {
  const cookieStore = await cookies();
  return cookieStore.get('auth_token')?.value;
}

export async function clearAuthCookie() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_token');
}

export async function getCurrentUser() {
  const token = await getAuthCookie();
  if (!token) return null;

  const payload = await verifyJWT(token);
  if (!payload) return null;

  const user = await getOne('SELECT * FROM users WHERE id = $1', [
    payload.userId,
  ]);
  return user ? { ...user, role: payload.role, businessId: payload.businessId } : null;
}

export function generateOTP(): string {
  return randomInt(100000, 1000000).toString();
}

// Get token from either Authorization header or cookie
export async function getTokenFromRequest(request: any): Promise<string | null> {
  // Try Authorization header first
  const authHeader = request.headers?.get?.('authorization');
  if (authHeader) {
    const token = authHeader.replace('Bearer ', '');
    if (token) return token;
  }

  // Fall back to cookie
  try {
    const cookieToken = await getAuthCookie();
    if (cookieToken) return cookieToken;
  } catch (error) {
    // getAuthCookie throws in some contexts, ignore
  }

  return null;
}

export const verifyToken = verifyJWT;
