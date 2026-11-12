import crypto from 'node:crypto'
import { query } from '@/lib/db'
import { generateId } from '@/lib/utils-extended'

/**
 * Registration rate limiting.
 *
 * The repo had no limiter before this batch, so this is new and additive.
 *
 * Design:
 *  - Postgres-backed (registration_attempts) so limits hold across serverless
 *    instances. Identifiers are stored as SHA-256 hashes, never raw emails or IPs.
 *  - If the table is missing (SQL not run yet) or the write fails, it degrades to
 *    an in-process sliding window. That is weaker but never open.
 *  - Windows are sliding, evaluated on read, so there is no cron to forget.
 *
 * This limiter is used only by public registration endpoints.
 */

export type Rule = { limit: number; windowSeconds: number; name: string }

/** Two simultaneous windows per identifier: a burst and a daily ceiling. */
export const REGISTRATION_IP_RULES: Rule[] = [
  { name: 'ip-10m', limit: 3, windowSeconds: 10 * 60 },
  { name: 'ip-24h', limit: 20, windowSeconds: 24 * 60 * 60 },
]

export const REGISTRATION_EMAIL_RULES: Rule[] = [
  { name: 'email-10m', limit: 2, windowSeconds: 10 * 60 },
  { name: 'email-24h', limit: 5, windowSeconds: 24 * 60 * 60 },
]

export const SLUG_CHECK_RULES: Rule[] = [
  { name: 'slug-1m', limit: 60, windowSeconds: 60 },
]

const memory = new Map<string, number[]>()

function salt(): string {
  return process.env.RATE_LIMIT_SALT || process.env.JWT_SECRET || 'foodbase-registration'
}

/** Stable, non-reversible identifier for storage and in-memory keys. */
export function hashIdentifier(kind: string, value: string): string {
  return crypto.createHash('sha256').update(`${kind}:${salt()}:${value}`).digest('hex')
}

export type LimitResult = {
  allowed: boolean
  /** Seconds until the caller may try again. Only set when blocked. */
  retryAfterSeconds?: number
  /** Which rule blocked, for server logs only. Never returned to the browser. */
  rule?: string
  /** True when the result came from the in-memory fallback. */
  degraded?: boolean
}

function memoryCount(key: string, windowSeconds: number): { count: number; oldest: number | null } {
  const now = Date.now()
  const cutoff = now - windowSeconds * 1000
  const hits = (memory.get(key) ?? []).filter((time) => time >= cutoff)
  memory.set(key, hits)
  return { count: hits.length, oldest: hits[0] ?? null }
}

function memoryRecord(key: string) {
  const hits = memory.get(key) ?? []
  hits.push(Date.now())
  // Hard cap so a flood cannot grow this map without bound.
  if (hits.length > 200) hits.splice(0, hits.length - 200)
  memory.set(key, hits)
}

async function dbCount(hash: string, windowSeconds: number): Promise<{ count: number; oldest: Date | null } | null> {
  try {
    const rows: any = await query(
      `SELECT COUNT(*)::int AS count,
              MIN(created_at) AS oldest
         FROM registration_attempts
        WHERE identifier = $1
          AND created_at >= NOW() - ($2 || ' seconds')::interval`,
      [hash, String(windowSeconds)],
    )
    const row = Array.isArray(rows) ? rows[0] : rows?.rows?.[0]
    if (!row) return { count: 0, oldest: null }
    return { count: Number(row.count ?? 0), oldest: row.oldest ? new Date(row.oldest) : null }
  } catch {
    return null
  }
}

async function dbRecord(bucket: string, hash: string): Promise<boolean> {
  try {
    await query('INSERT INTO registration_attempts (id, bucket, identifier) VALUES ($1, $2, $3)', [
      generateId('ra'),
      bucket,
      hash,
    ])
    return true
  } catch {
    return false
  }
}

/** Opportunistic prune so the table does not grow forever. Best effort. */
async function maybePrune() {
  if (Math.random() > 0.03) return
  try {
    await query("DELETE FROM registration_attempts WHERE created_at < NOW() - INTERVAL '2 days'")
  } catch {
    // ignore
  }
}

/**
 * Counts recent attempts for one identifier and, if allowed, records this one.
 * Call it once per request, before doing any expensive work.
 */
export async function enforceLimit(bucket: 'ip' | 'email' | 'slug', identifier: string, rules: Rule[]): Promise<LimitResult> {
  const hash = hashIdentifier(bucket, identifier)

  for (const rule of rules) {
    const stored = await dbCount(hash, rule.windowSeconds)
    if (stored) {
      if (stored.count >= rule.limit) {
        const elapsed = stored.oldest ? (Date.now() - stored.oldest.getTime()) / 1000 : 0
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil(rule.windowSeconds - elapsed)),
          rule: rule.name,
        }
      }
    } else {
      // Table missing or query failed: in-memory fallback for this instance.
      const local = memoryCount(`${hash}:${rule.windowSeconds}`, rule.windowSeconds)
      if (local.count >= rule.limit) {
        const elapsed = local.oldest ? (Date.now() - local.oldest) / 1000 : 0
        return {
          allowed: false,
          retryAfterSeconds: Math.max(1, Math.ceil(rule.windowSeconds - elapsed)),
          rule: rule.name,
          degraded: true,
        }
      }
    }
  }

  const stored = await dbRecord(bucket, hash)
  if (!stored) {
    for (const rule of rules) memoryRecord(`${hash}:${rule.windowSeconds}`)
    void maybePrune()
    return { allowed: true, degraded: true }
  }
  void maybePrune()
  return { allowed: true }
}

/** Client IP as seen by the platform. Falls back to a constant so a missing header cannot bypass limits. */
export function clientIpFrom(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]!.trim()
  return (
    headers.get('x-real-ip') ||
    headers.get('cf-connecting-ip') ||
    headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  )
}

/** Human sentence for the 429 body. Deliberately vague about which rule fired. */
export function rateLimitMessage(retryAfterSeconds?: number): string {
  const seconds = retryAfterSeconds ?? 60
  if (seconds >= 3600) {
    const hours = Math.ceil(seconds / 3600)
    return `Too many attempts from this connection. Try again in ${hours} hour${hours === 1 ? '' : 's'}, or sign in if you already have an account.`
  }
  const minutes = Math.max(1, Math.ceil(seconds / 60))
  return `Too many attempts from this connection. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}, or sign in if you already have an account.`
}
