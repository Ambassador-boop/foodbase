/**
 * Validation for public restaurant registration.
 *
 * Kept out of the route so the client form and the server share one source of
 * truth for the slug rules, the reserved words and the password policy.
 * Nothing here touches auth or payment logic.
 */

import { z } from 'zod'

/** Slugs the product needs for itself, or that would collide with real pages. */
export const RESERVED_SLUGS = [
  'admin',
  'api',
  'dashboard',
  'login',
  'register',
  'account',
  'accounts',
  'security',
  'pricing',
  'terms',
  'privacy',
  'about',
  'restaurants',
  'payment-success',
  'forgot-password',
  'cancellation-policy',
  'refund-policy',
  // Additional live routes in this app that are not storefronts.
  'register-restaurant',
  'verify-email',
  'support',
  'help',
  'www',
  'app',
  'static',
  'assets',
  'public',
  'checkout',
  'cart',
  'receipt',
] as const

export const SLUG_MIN = 3
export const SLUG_MAX = 40
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export const TERMS_VERSION = '2026-11-01'
export const PRIVACY_VERSION = '2026-11-01'

/** Max characters we keep for a user agent in the consent log. */
const UA_LIMIT = 400

/* ------------------------------- phone ------------------------------- */

/**
 * Nigerian numbers only. Accepts the forms people actually type:
 *   08031234567 · 8031234567 · +2348031234567 · 234 803 123 4567
 * Returns the canonical local form (0XXXXXXXXXX) so storage stays consistent
 * with what the rest of the app expects.
 */
export function normaliseNigerianPhone(input: string): string | null {
  const digits = String(input ?? '').replace(/[^\d+]/g, '')
  let local = digits.replace(/^\+/, '')

  if (local.startsWith('234')) local = `0${local.slice(3)}`
  else if (!local.startsWith('0')) local = `0${local}`

  if (!/^0\d{10}$/.test(local)) return null

  // Valid Nigerian mobile prefixes (070/080/081/090/091 and the 070x ranges).
  const prefix = local.slice(0, 4)
  const valid = [
    '0701', '0702', '0703', '0704', '0705', '0706', '0707', '0708', '0709',
    '0802', '0803', '0804', '0805', '0806', '0807', '0808', '0809',
    '0810', '0811', '0812', '0813', '0814', '0815', '0816', '0817', '0818', '0819',
    '0901', '0902', '0903', '0904', '0905', '0906', '0907', '0908', '0909',
    '0911', '0912', '0913', '0915', '0916',
  ]
  return valid.includes(prefix) ? local : null
}

/** Display form: 0803 123 4567 */
export function formatPhoneForDisplay(local: string): string {
  if (!/^0\d{10}$/.test(local)) return local
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`
}

/* -------------------------------- slug -------------------------------- */

/** Auto-suggest a slug from a restaurant name. Always returns a slug-shaped string. */
export function suggestSlug(name: string): string {
  const base = String(name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-$/, '')

  // Never pre-fill a suggestion the rules will reject. "Admin Kitchen" is fine,
  // a restaurant literally called "Admin" gets a suffix instead of an error.
  if (RESERVED_SLUGS.includes(base as (typeof RESERVED_SLUGS)[number])) {
    return `${base.slice(0, SLUG_MAX - 2)}-2`
  }
  return base
}

export type SlugCheck = { ok: true; slug: string } | { ok: false; reason: string }

/** Validates a slug on its own, before checking the database. */
export function checkSlugShape(input: string): SlugCheck {
  const slug = String(input ?? '').trim().toLowerCase()
  if (slug.length < SLUG_MIN) return { ok: false, reason: `Use at least ${SLUG_MIN} characters.` }
  if (slug.length > SLUG_MAX) return { ok: false, reason: `Use ${SLUG_MAX} characters or fewer.` }
  if (!SLUG_PATTERN.test(slug)) {
    return { ok: false, reason: 'Use lowercase letters, numbers and single hyphens.' }
  }
  if (RESERVED_SLUGS.includes(slug as (typeof RESERVED_SLUGS)[number])) {
    return { ok: false, reason: 'That address is reserved. Choose another.' }
  }
  return { ok: true, slug }
}

/* ------------------------------ password ------------------------------ */

export type PasswordStrength = {
  score: 1 | 2 | 3 | 4
  label: 'Weak' | 'Fair' | 'Good' | 'Strong'
  problems: string[]
}

/**
 * Minimum policy: 8 characters, and not built from one repeated run.
 * Score is intentionally about length + variety, not a fake entropy number.
 */
export function scorePassword(password: string): PasswordStrength {
  const value = String(password ?? '')
  const problems: string[] = []
  if (value.length < 8) problems.push('At least 8 characters')

  const hasLower = /[a-z]/.test(value)
  const hasUpper = /[A-Z]/.test(value)
  const hasDigit = /\d/.test(value)
  const hasSymbol = /[^A-Za-z0-9]/.test(value)
  const variety = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length
  const isRepeated = value.length > 0 && /^(.)\1+$/.test(value)
  const isCommon = ['password', 'password1', '12345678', 'qwerty123', 'letmein1'].includes(value.toLowerCase())

  if (isRepeated) problems.push('Avoid one repeated character')
  if (isCommon) problems.push('This password is too common')

  let score: 1 | 2 | 3 | 4 = 1
  if (value.length >= 8 && variety >= 2) score = 2
  if (value.length >= 10 && variety >= 3) score = 3
  if (value.length >= 12 && variety >= 3) score = 4
  if (isRepeated || isCommon) score = 1

  const label = (['Weak', 'Fair', 'Good', 'Strong'] as const)[score - 1]
  return { score, label, problems }
}

/* --------------------------- disposable email --------------------------- */

/**
 * A short, maintained-in-repo list. This is a speed bump for throwaway signups,
 * not a security boundary; it is deliberately small so real businesses that use
 * a niche provider are never locked out.
 */
export const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  '10minutemail.com',
  '10minutemail.net',
  'tempmail.com',
  'temp-mail.org',
  'throwawaymail.com',
  'yopmail.com',
  'sharklasers.com',
  'getnada.com',
  'trashmail.com',
  'dispostable.com',
  'maildrop.cc',
  'fakeinbox.com',
  'mintemail.com',
  'spamgourmet.com',
  'mailnesia.com',
  'emailondeck.com',
  'moakt.com',
  'tempr.email',
  'discard.email',
])

export function isDisposableEmail(email: string): boolean {
  const domain = String(email ?? '').toLowerCase().split('@')[1]?.trim()
  if (!domain) return false
  if (DISPOSABLE_DOMAINS.has(domain)) return true
  // Sub-domains of known throwaway hosts (e.g. anything.mailinator.com).
  for (const blocked of DISPOSABLE_DOMAINS) {
    if (domain.endsWith(`.${blocked}`)) return true
  }
  return false
}

/* ------------------------------ the schema ------------------------------ */

export const registrationSchema = z.object({
  first_name: z
    .string()
    .trim()
    .min(2, 'Enter your first name.')
    .max(60, 'Keep this under 60 characters.')
    .regex(/^[\p{L}\p{M}'’ -]+$/u, 'Use letters, spaces, hyphens and apostrophes only.'),
  last_name: z
    .string()
    .trim()
    .min(2, 'Enter your last name.')
    .max(60, 'Keep this under 60 characters.')
    .regex(/^[\p{L}\p{M}'’ -]+$/u, 'Use letters, spaces, hyphens and apostrophes only.'),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(255),
  phone: z.string().trim().refine((value) => normaliseNigerianPhone(value) !== null, {
    message: 'Enter a Nigerian mobile number, for example 0803 123 4567.',
  }),
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
    .max(200, 'Keep this under 200 characters.'),
  restaurant_name: z
    .string()
    .trim()
    .min(2, 'Enter your restaurant name.')
    .max(120, 'Keep this under 120 characters.'),
  slug: z.string().trim().toLowerCase(),
  city: z
    .string()
    .trim()
    .min(2, 'Enter the city your kitchen is in.')
    .max(80, 'Keep this under 80 characters.'),
  state: z
    .string()
    .trim()
    .min(2, 'Choose the state your kitchen is in.')
    .max(80, 'Keep this under 80 characters.')
    // Same list the select renders, so an API caller cannot store a state the
    // product cannot display or filter on.
    .refine((value) => NIGERIAN_STATES.includes(value as (typeof NIGERIAN_STATES)[number]), {
      message: 'Choose the state your kitchen is in.',
    }),
  accept_terms: z.literal(true, {
    errorMap: () => ({ message: 'Accept the terms and privacy notice to continue.' }),
  }),
  /** Honeypot. Must stay empty; it is hidden from real users and assistive tech. */
  company_website: z.string().max(0, 'Leave this field empty.').optional().default(''),
  terms_version: z.string().trim().max(32).optional(),
  privacy_version: z.string().trim().max(32).optional(),
})

export type RegistrationInput = z.infer<typeof registrationSchema>

/** Flattens a zod error into { field: message } for inline display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const output: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form')
    if (!output[key]) output[key] = issue.message
  }
  return output
}

export function truncateUserAgent(value: string | null | undefined): string | null {
  if (!value) return null
  return value.slice(0, UA_LIMIT)
}

/** Nigerian states, used by the form's select. */
export const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT - Abuja', 'Gombe',
  'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos',
  'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto',
  'Taraba', 'Yobe', 'Zamfara',
] as const
