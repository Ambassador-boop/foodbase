import { NextRequest, NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { getOne, query } from '@/lib/db'
import { generateId } from '@/lib/utils-extended'
import { sendEmailVerificationEmail } from '@/lib/email'
import { enforceLimit, REGISTRATION_EMAIL_RULES } from '@/lib/registration/rate-limit'

/**
 * Email verification. Non-blocking by design: the dashboard never waits on it.
 *
 * GET  /api/auth/verify-email?token=…   → consumes the token, then redirects
 * POST /api/auth/verify-email           → resends the link to the signed-in owner
 */

const VERIFICATION_TTL_HOURS = 72

function originOf(request: NextRequest): string {
  return process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function redirectWith(request: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, originOf(request)))
}

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  const hasSession = Boolean(request.cookies.get('auth_token')?.value)
  const fallback = hasSession ? '/dashboard' : '/login'

  if (!token || token.length < 32) {
    return redirectWith(request, `${fallback}?email_verified=invalid`)
  }

  try {
    const row = await getOne(
      `SELECT id, user_id
         FROM email_verification_tokens
        WHERE token_hash = $1
          AND consumed_at IS NULL
          AND expires_at > NOW()
        LIMIT 1`,
      [hashToken(token)],
    )

    if (!row) {
      return redirectWith(request, `${fallback}?email_verified=expired`)
    }

    // Consume first so a double click cannot replay it.
    await query('UPDATE email_verification_tokens SET consumed_at = NOW() WHERE id = $1', [row.id])

    try {
      await query('UPDATE users SET email_verified = true, email_verified_at = NOW(), updated_at = NOW() WHERE id = $1', [
        row.user_id,
      ])
    } catch (error) {
      // Column not migrated yet: the token is still consumed and the banner
      // simply keeps showing. Never throw at the person clicking the link.
      console.warn('[verify-email] users.email_verified not available', error)
      return redirectWith(request, `${fallback}?email_verified=unavailable`)
    }

    return redirectWith(request, `${fallback}?email_verified=1`)
  } catch (error) {
    console.error('[verify-email] failed', error)
    return redirectWith(request, `${fallback}?email_verified=error`)
  }
}

export async function POST(request: NextRequest) {
  try {
    // Deliberately not importing getCurrentUser: this route only needs the id.
    const token = request.headers.get('authorization')?.replace('Bearer ', '') || request.cookies.get('auth_token')?.value
    if (!token) return NextResponse.json({ error: 'Sign in to resend the link.' }, { status: 401 })

    const { verifyJWT } = await import('@/lib/auth')
    const payload = await verifyJWT(token)
    const userId = payload ? (payload as { userId?: string; id?: string }).userId ?? (payload as { id?: string }).id : null
    if (!userId) return NextResponse.json({ error: 'Sign in to resend the link.' }, { status: 401 })

    const limit = await enforceLimit('email', `resend:${userId}`, REGISTRATION_EMAIL_RULES)
    if (!limit.allowed) {
      return NextResponse.json(
        { error: 'A link was sent recently. Check your inbox, including spam.' },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds ?? 600) } },
      )
    }

    const rows: any = await query(
      'SELECT id, email, first_name, email_verified FROM users WHERE id = $1 LIMIT 1',
      [userId],
    ).catch(() => null)
    const user = Array.isArray(rows) ? rows[0] : rows?.rows?.[0]
    if (!user) return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
    if (user.email_verified === true) return NextResponse.json({ success: true, alreadyVerified: true })

    const business: any = await query(
      'SELECT name FROM businesses WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1',
      [userId],
    ).catch(() => null)
    const businessRow = Array.isArray(business) ? business[0] : business?.rows?.[0]

    const raw = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_HOURS * 3600 * 1000)
    await query(
      `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [generateId('evt'), userId, hashToken(raw), expiresAt.toISOString()],
    )

    const sent = await sendEmailVerificationEmail({
      email: user.email,
      ownerName: user.first_name || 'there',
      restaurantName: businessRow?.name || 'your restaurant',
      verifyUrl: `${originOf(request)}/api/auth/verify-email?token=${raw}`,
      expiresInHours: VERIFICATION_TTL_HOURS,
    })

    if (!sent) {
      return NextResponse.json(
        { error: 'The email service is not reachable right now. Try again shortly.' },
        { status: 502 },
      )
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[verify-email] resend failed', error)
    return NextResponse.json({ error: 'Could not send the link right now.' }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
