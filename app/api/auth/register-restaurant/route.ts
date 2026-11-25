import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import crypto from 'node:crypto'
import { nanoid } from 'nanoid'
import { getOne, query } from '@/lib/db'
import { hashPassword, createJWT, setAuthCookie } from '@/lib/auth'
import { ACTIVE_BUSINESS_COOKIE } from '@/lib/active-business'
import {
  registrationSchema,
  fieldErrors,
  normaliseNigerianPhone,
  checkSlugShape,
  isDisposableEmail,
  scorePassword,
  TERMS_VERSION,
  PRIVACY_VERSION,
  truncateUserAgent,
} from '@/lib/registration/validation'
import {
  enforceLimit,
  clientIpFrom,
  rateLimitMessage,
  REGISTRATION_IP_RULES,
  REGISTRATION_EMAIL_RULES,
} from '@/lib/registration/rate-limit'
import { sendRestaurantWelcomeEmail, sendEmailVerificationEmail, sendNewRestaurantAdminEmail } from '@/lib/email'
import { generateId } from '@/lib/utils-extended'
import { env } from '@/lib/env';
import { fail } from '@/lib/api'
import { handleUnexpected } from '@/lib/api/handler'
import { RATE_LIMITS, enforceRateLimit } from '@/lib/rate-limit'

/**
 * POST /api/auth/register-restaurant
 *
 * Public self-registration for restaurants. Creates the owner user and the
 * business together, signs the owner in with the same JWT cookie the login
 * route uses, and returns /dashboard/onboarding.
 *
 * Hard rules honoured here:
 *  - Same role value ('business_owner') and same hashing helper as login.
 *  - Business is created with is_active = true (no approval step).
 *  - No payments, refunds, settlement, withdrawal or PIN code is touched.
 *  - Every new table/column is optional: if the Batch 3A SQL has not been run,
 *    consent logging, verification tokens and rate limiting degrade safely.
 */

const VERIFICATION_TTL_HOURS = 72

/**
 * One field to one message, in the envelope lib/api uses.
 *
 * The registration schema reports a single message per field; the envelope
 * carries a list, so the existing sentence is wrapped rather than reshaped.
 */
function fieldList(errors: Record<string, string>): Record<string, string[]> {
  return Object.fromEntries(Object.entries(errors).map(([key, message]) => [key, [message]]))
}

/** A validation failure: 422, with the field messages the form renders inline. */
function fieldError(fields: Record<string, string>) {
  return fail('VALIDATION_ERROR', 'Check the highlighted fields.', 422, fieldList(fields))
}

/** Neon is HTTP-based, so a real transaction is not available. We compensate instead. */
async function safeDeleteUser(userId: string) {
  try {
    await query('DELETE FROM users WHERE id = $1', [userId])
  } catch (error) {
    console.error('[register-restaurant] rollback failed', error)
  }
}

async function createVerificationToken(userId: string): Promise<string | null> {
  try {
    const token = crypto.randomBytes(32).toString('hex')
    const hash = crypto.createHash('sha256').update(token).digest('hex')
    const expiresAt = new Date(Date.now() + VERIFICATION_TTL_HOURS * 3600 * 1000)
    await query(
      `INSERT INTO email_verification_tokens (id, user_id, token_hash, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [generateId('evt'), userId, hash, expiresAt.toISOString()],
    )
    return token
  } catch (error) {
    // Column/table not migrated yet, or a transient failure. Verification is
    // optional, so registration must still succeed.
    console.warn('[register-restaurant] verification token not stored', error)
    return null
  }
}

async function recordConsent(input: {
  userId: string
  businessId: string
  email: string
  ip: string
  userAgent: string | null
}) {
  try {
    await query(
      `INSERT INTO registration_consents
         (id, user_id, business_id, email, terms_version, privacy_version, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        generateId('rc'),
        input.userId,
        input.businessId,
        input.email,
        TERMS_VERSION,
        PRIVACY_VERSION,
        input.ip.slice(0, 64),
        input.userAgent,
      ],
    )
  } catch (error) {
    // Audit trail is additive; never fail a registration because of it.
    console.warn('[register-restaurant] consent not recorded', error)
  }
}

async function registerRestaurant(request: NextRequest) {
  const ip = clientIpFrom(request.headers)

  // ---- Rate limit before parsing anything expensive -------------------------
  const ipLimit = await enforceLimit('ip', ip, REGISTRATION_IP_RULES)
  if (!ipLimit.allowed) {
    const response = fail('RATE_LIMITED', rateLimitMessage(ipLimit.retryAfterSeconds), 429)
    response.headers.set('Retry-After', String(ipLimit.retryAfterSeconds ?? 60))
    return response
  }
  // The platform-wide limiter (fb_rate_limit): 5 sign-ups per hour per IP.
  const signUpLimited = await enforceRateLimit(request, RATE_LIMITS.signUpIp)
  if (signUpLimited) return signUpLimited

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail('INVALID_JSON', 'Send the form as JSON.', 400)
  }

  const parsed = registrationSchema.safeParse(body)
  if (!parsed.success) {
    const errors = fieldErrors(parsed.error)
    // The honeypot is a bot signal, not a user error. Answer generically.
    if (errors.company_website) {
      return fail('REGISTRATION_REFUSED', 'We could not create this account. Check your details and try again.', 400)
    }
    return fieldError(errors)
  }

  const data = parsed.data

  // ---- Honeypot: hidden field a human never sees ---------------------------
  if (data.company_website && data.company_website.length > 0) {
    return fail('REGISTRATION_REFUSED', 'We could not create this account. Check your details and try again.', 400)
  }

  // ---- Phone (canonical local form) ---------------------------------------
  const phone = normaliseNigerianPhone(data.phone)
  if (!phone) {
    return fieldError({ phone: 'Enter a Nigerian mobile number, for example 0803 123 4567.' })
  }

  // ---- Password policy -----------------------------------------------------
  const strength = scorePassword(data.password)
  if (data.password.length < 8 || strength.score < 2) {
    return fieldError({ password: 'Use at least 8 characters, with a mix of letters and numbers.' })
  }

  // ---- Email reputation ----------------------------------------------------
  if (isDisposableEmail(data.email)) {
    return fieldError({ email: 'Use a permanent business email address.' })
  }

  // ---- Email rate limit (after validation so typos do not burn the budget) --
  const emailLimit = await enforceLimit('email', data.email, REGISTRATION_EMAIL_RULES)
  if (!emailLimit.allowed) {
    const response = fail('RATE_LIMITED', rateLimitMessage(emailLimit.retryAfterSeconds), 429)
    response.headers.set('Retry-After', String(emailLimit.retryAfterSeconds ?? 60))
    return response
  }

  // ---- Slug ---------------------------------------------------------------
  const slugCheck = checkSlugShape(data.slug)
  if (!slugCheck.ok) {
    return fieldError({ slug: slugCheck.reason })
  }
  const slug = slugCheck.slug

  // ---- Uniqueness ---------------------------------------------------------
  try {
    const existingEmail = await getOne('SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1', [data.email])
    if (existingEmail) {
      // Registration inherently reveals this; we keep the message short and give
      // the useful next step rather than confirming anything else about the account.
      return fail('EMAIL_TAKEN', 'An account already uses this email.', 409, {
        email: ['Sign in instead, or register with a different address.'],
      })
    }

    const existingPhone = await getOne(
      'SELECT id FROM businesses WHERE REGEXP_REPLACE(COALESCE(phone, \'\'), \'\\D\', \'\', \'g\') = $1 LIMIT 1',
      [phone],
    )
    if (existingPhone) {
      return fail('PHONE_TAKEN', 'That phone number is already in use.', 409, {
        phone: ['Use a different number, or sign in to the existing account.'],
      })
    }

    const existingSlug = await getOne('SELECT id FROM businesses WHERE LOWER(slug) = $1 LIMIT 1', [slug])
    if (existingSlug) {
      return fail('SLUG_TAKEN', 'That storefront address is taken.', 409, {
        slug: ['Try a different address, for example adding your city.'],
      })
    }
  } catch (error) {
    console.error('[register-restaurant] uniqueness check failed', error)
    return fail('LOOKUP_FAILED', 'We could not create the account right now. Try again in a moment.', 500)
  }

  // ---- Create owner + business -------------------------------------------
  const userId = `usr_${nanoid(14)}`
  const businessId = `bus_${nanoid(14)}`
  const passwordHash = await hashPassword(data.password)
  const ownerName = `${data.first_name} ${data.last_name}`

  try {
    await query(
      `INSERT INTO users (id, first_name, last_name, email, phone, role, password_hash, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
      [userId, data.first_name, data.last_name, data.email, phone, 'business_owner', passwordHash, true],
    )
  } catch (error: unknown) {
    const code = (error as { code?: string })?.code
    console.error('[register-restaurant] user insert failed', error)
    if (code === '23505') {
      return fail('EMAIL_TAKEN', 'An account already uses this email.', 409, {
        email: ['Sign in instead, or register with a different address.'],
      })
    }
    return fail('USER_CREATE_FAILED', 'We could not create the account right now. Try again in a moment.', 500)
  }

  try {
    await query(
      `INSERT INTO businesses
         (id, owner_id, name, slug, email, phone, city, state, country, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())`,
      [businessId, userId, data.restaurant_name, slug, data.email, phone, data.city, data.state, 'Nigeria', true],
    )
  } catch (error: unknown) {
    console.error('[register-restaurant] business insert failed', error)
    await safeDeleteUser(userId)
    const code = (error as { code?: string })?.code
    if (code === '23505') {
      return fail('SLUG_TAKEN', 'That storefront address is taken.', 409, {
        slug: ['Try a different address, for example adding your city.'],
      })
    }
    return fail('BUSINESS_CREATE_FAILED', 'We could not finish creating your restaurant. Try again in a moment.', 500)
  }

  // ---- Consent audit (non-critical) --------------------------------------
  await recordConsent({
    userId,
    businessId,
    email: data.email,
    ip,
    userAgent: truncateUserAgent(request.headers.get('user-agent')),
  })

  // ---- Sign in with the existing cookie flow ------------------------------
  try {
    const token = await createJWT({ userId, role: 'business_owner', businessId })
    await setAuthCookie(token)
    const cookieStore = await cookies()
    cookieStore.set(ACTIVE_BUSINESS_COOKIE, businessId, {
      httpOnly: true,
      secure: env.isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    })
  } catch (error) {
    // The account exists; the failure is only the session. Tell the client to log in.
    console.error('[register-restaurant] session creation failed', error)
    return NextResponse.json(
      {
        success: true,
        redirectUrl: '/login?registered=1',
        message: 'Your restaurant is live. Sign in to finish setting up.',
      },
      { status: 201 },
    )
  }

  // ---- Email. Never blocks the response. ---------------------------------
  const origin = env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  const adminEmail = env.ADMIN_NOTIFICATION_EMAIL || env.BREVO_EMAIL || null

  // Awaited rather than fired-and-forgotten: on a serverless runtime the process
  // can be frozen the moment the response is written, which would drop these
  // emails. Each send is individually guarded, so a mail failure never fails a
  // registration that already exists.
  await (async () => {
    try {
      await sendRestaurantWelcomeEmail({
        email: data.email,
        ownerName: ownerName,
        restaurantName: data.restaurant_name,
        slug,
        dashboardUrl: `${origin}/dashboard/onboarding`,
      })
    } catch (error) {
      console.error('[register-restaurant] welcome email failed', error)
    }

    try {
      const verifyToken = await createVerificationToken(userId)
      if (verifyToken) {
        await sendEmailVerificationEmail({
          email: data.email,
          ownerName: ownerName,
          restaurantName: data.restaurant_name,
          verifyUrl: `${origin}/api/auth/verify-email?token=${verifyToken}`,
          expiresInHours: VERIFICATION_TTL_HOURS,
        })
      }
    } catch (error) {
      console.error('[register-restaurant] verification email failed', error)
    }

    if (adminEmail) {
      try {
        await sendNewRestaurantAdminEmail({
          to: adminEmail,
          restaurantName: data.restaurant_name,
          ownerName,
          email: data.email,
          phone,
          slug,
          city: data.city,
          state: data.state,
          createdAt: new Date().toISOString(),
          businessUrl: `${origin}/admin/businesses/${businessId}`,
        })
      } catch (error) {
        console.error('[register-restaurant] admin notice failed', error)
      }
    }
  })()

  return NextResponse.json(
    {
      success: true,
      redirectUrl: '/dashboard/onboarding',
      business: { id: businessId, name: data.restaurant_name, slug },
    },
    { status: 201 },
  )
}

/**
 * The outer guard. Everything above returns its own envelope; anything that
 * escapes (a driver failure, an unexpected throw) becomes one logged 500 with a
 * request id instead of a stack trace.
 */
export async function POST(request: NextRequest) {
  try {
    return await registerRestaurant(request)
  } catch (error) {
    return handleUnexpected(error, { where: 'POST /api/auth/register-restaurant', request })
  }
}

/** Never cache a registration response. */
export const dynamic = 'force-dynamic'
