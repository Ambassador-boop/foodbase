import crypto from 'node:crypto';
import { comparePin } from '@/lib/pin-utils';
import { db } from '@/lib/db';

export const PIN_MAX_ATTEMPTS = 5;
export const PIN_LOCK_MINUTES = 15;
export const TICKET_TTL_SECONDS = 300;

type Row = Record<string, any>;
function rowsOf(raw: any): Row[] { return Array.isArray(raw) ? raw : raw?.rows ?? []; }
function jsonResult(value: any): any { return typeof value === 'string' ? JSON.parse(value) : value ?? {}; }

export function pinEnforced(): boolean { return process.env.PIN_ENFORCEMENT === 'on'; }
export function normalizeAmount(n: unknown): string { return Number(n).toFixed(2); }

export async function getPinStatus(userId: string) {
  const raw = await db.query('SELECT fb_pin_status($1) AS result', [userId]);
  const result = jsonResult(rowsOf(raw)[0]?.result);
  return { hasPin: Boolean(result.has_pin ?? result.hasPin), locked: Boolean(result.locked), lockedUntil: result.locked_until ?? result.lockedUntil ?? null };
}

export async function verifyPinAndIssueTicket(input: { userId: string; businessId: string | null; action: string; bind: Record<string, string>; pin: string }) {
  const attemptRaw = await db.query('SELECT fb_pin_begin_attempt($1,$2,$3) AS result', [input.userId, PIN_MAX_ATTEMPTS, PIN_LOCK_MINUTES]);
  const attempt = jsonResult(rowsOf(attemptRaw)[0]?.result);
  if (attempt.allowed === false) return { ok: false as const, code: 'LOCKED' as const, lockedUntil: attempt.locked_until ?? attempt.lockedUntil ?? null };
  const hashRaw = await db.query('SELECT pin_hash FROM users WHERE id=$1', [input.userId]);
  const hash = rowsOf(hashRaw)[0]?.pin_hash;
  if (!hash) {
    await db.query('SELECT fb_pin_record_success($1)', [input.userId]);
    return { ok: false as const, code: 'PIN_NOT_SET' as const };
  }
  if (!(await comparePin(input.pin, hash))) return { ok: false as const, code: 'WRONG_PIN' as const, attemptsLeft: Number(attempt.attempts_left ?? 0) };
  await db.query('SELECT fb_pin_record_success($1)', [input.userId]);
  const ticket = crypto.randomBytes(24).toString('hex');
  await db.query('SELECT fb_issue_authorization($1,$2,$3,$4,$5::jsonb,$6)', [ticket, input.userId, input.businessId, input.action, JSON.stringify(input.bind), TICKET_TTL_SECONDS]);
  return { ok: true as const, ticket };
}

export async function consumeTicket(input: { ticket: string; userId: string; businessId: string | null; action: string; bind: Record<string, string> }): Promise<boolean> {
  const raw = await db.query('SELECT fb_consume_authorization($1,$2,$3,$4,$5::jsonb) AS result', [input.ticket, input.userId, input.businessId, input.action, JSON.stringify(input.bind)]);
  const result = jsonResult(rowsOf(raw)[0]?.result);
  return result === true || result?.ok === true || result?.authorized === true || result?.valid === true;
}

export async function requireTicket(input: { ticket?: string; userId: string; businessId: string | null; action: string; bind: Record<string, string> }): Promise<boolean> {
  if (!pinEnforced()) return true;
  if (!input.ticket) return false;
  return consumeTicket({ ...input, ticket: input.ticket });
}
