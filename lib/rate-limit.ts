import { NextResponse } from 'next/server';
import { db, rowsOf } from './db';
import { fail } from './api/response';

/**
 * Rate limiting on top of the Postgres function `fb_rate_limit`.
 *
 * Why Postgres: the app runs as many serverless instances, so an in-process
 * counter would let a caller multiply its allowance by the number of instances.
 * `fb_rate_limit(p_key text, p_max integer, p_window_seconds integer)` returns a
 * boolean and owns the counting, the window and the storage. Nothing here
 * reimplements it, and nothing here writes to the rate-limit table directly.
 *
 * Key shape: `<route>:<client ip>` and, when the caller is signed in,
 * `:u:<user id>`. An email-based rule appends `:e:<email>`.
 *
 * The key is handed to `fb_rate_limit` exactly as built, so only ever pass an
 * IP, a user id or an email as an identifier. Never a password, a token or a
 * session value.
 *
 * Failure policy: if the database call fails, the request is ALLOWED and the
 * failure is logged. A limiter outage must not take ordering down.
 */

export interface RateLimitRule {
  /** Stable label, also used as the key prefix. */
  name: string;
  /** Requests allowed inside the window. */
  max: number;
  /** Window length in seconds. */
  windowSeconds: number;
}

export const RATE_LIMITS = {
  /** Sign-in: 10 per 10 minutes, per IP and separately per email. */
  signInIp: { name: 'auth:login:ip', max: 10, windowSeconds: 10 * 60 },
  signInEmail: { name: 'auth:login:email', max: 10, windowSeconds: 10 * 60 },
  /** Sign-up: 5 per hour per IP. */
  signUpIp: { name: 'auth:register:ip', max: 5, windowSeconds: 60 * 60 },
  /** OTP send: 5 per hour per email. */
  otpSendEmail: { name: 'otp:send:email', max: 5, windowSeconds: 60 * 60 },
  /** OTP verify: 10 per 10 minutes, per IP and per email. */
  otpVerifyIp: { name: 'otp:verify:ip', max: 10, windowSeconds: 10 * 60 },
  otpVerifyEmail: { name: 'otp:verify:email', max: 10, windowSeconds: 10 * 60 },
  /** Order creation and checkout: 20 per 10 minutes per IP. */
  orderCreateIp: { name: 'orders:create:ip', max: 20, windowSeconds: 10 * 60 },
  checkoutIp: { name: 'payments:initialize:ip', max: 20, windowSeconds: 10 * 60 },
  /** Money out, per signed-in user. */
  refundUser: { name: 'refunds:request:user', max: 10, windowSeconds: 60 * 60 },
  withdrawalUser: { name: 'withdrawals:request:user', max: 10, windowSeconds: 60 * 60 },
  /** Public restaurant browsing: 60 per minute per IP. */
  publicSearchIp: { name: 'public:search:ip', max: 60, windowSeconds: 60 },
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitName = keyof typeof RATE_LIMITS;

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds to wait. Only meaningful when `allowed` is false. */
  retryAfterSeconds: number;
  /** True when the limiter itself failed and the request was let through. */
  degraded: boolean;
}

/** The first entry of x-forwarded-for, as set by the platform's proxy. */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return (
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

export interface RateLimitKeyParts {
  /** Signed-in user id, when there is one. */
  userId?: string | null;
  /** Email or other identity the rule is counted against. */
  identifier?: string | null;
}

/** `<route>:<ip>[:u:<userId>][:e:<identifier>]` */
export function rateLimitKey(rule: RateLimitRule, ip: string, parts: RateLimitKeyParts = {}): string {
  const chunks = [`${rule.name}:${ip}`];
  if (parts.userId) chunks.push(`u:${parts.userId}`);
  if (parts.identifier) chunks.push(`e:${String(parts.identifier).trim().toLowerCase()}`);
  return chunks.join(':');
}

/**
 * Asks the database whether this key is still inside its allowance.
 *
 * A database failure allows the request and logs the rule name only: the key
 * contains an IP or an email, which does not belong in a log line.
 */
export async function checkRateLimit(
  rule: RateLimitRule,
  ip: string,
  parts: RateLimitKeyParts = {},
): Promise<RateLimitResult> {
  const key = rateLimitKey(rule, ip, parts);
  try {
    const raw = await db.query('SELECT fb_rate_limit($1, $2, $3) AS allowed', [
      key,
      rule.max,
      rule.windowSeconds,
    ]);
    const row = rowsOf<{ allowed: boolean | string }>(raw)[0];
    const allowed = row?.allowed === true || row?.allowed === 't';
    return { allowed, retryAfterSeconds: rule.windowSeconds, degraded: false };
  } catch (error) {
    console.error(
      `[rate-limit] ${rule.name} unavailable, allowing the request: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
    return { allowed: true, retryAfterSeconds: 0, degraded: true };
  }
}

/**
 * Enforces one rule and returns the 429 to send, or null when the request may
 * continue.
 *
 *     const limited = await enforceRateLimit(request, RATE_LIMITS.orderCreateIp);
 *     if (limited) return limited;
 */
export async function enforceRateLimit(
  request: Request,
  rule: RateLimitRule,
  parts: RateLimitKeyParts = {},
): Promise<NextResponse | null> {
  const result = await checkRateLimit(rule, clientIp(request), parts);
  if (result.allowed) return null;
  return rateLimitedResponse(result.retryAfterSeconds);
}

/** 429 in the standard envelope, with Retry-After. */
export function rateLimitedResponse(retryAfterSeconds: number): NextResponse {
  const response = fail(
    'RATE_LIMITED',
    'Too many attempts. Please wait a moment and try again.',
    429,
  );
  response.headers.set('Retry-After', String(Math.max(1, Math.ceil(retryAfterSeconds))));
  return response;
}
