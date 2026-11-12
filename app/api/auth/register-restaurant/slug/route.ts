import { NextRequest, NextResponse } from 'next/server'
import { getOne } from '@/lib/db'
import { checkSlugShape, suggestSlug, SLUG_MAX } from '@/lib/registration/validation'
import { enforceLimit, clientIpFrom, SLUG_CHECK_RULES } from '@/lib/registration/rate-limit'

/**
 * GET /api/auth/register-restaurant/slug?slug=…&name=…
 *
 * Live availability check for the storefront address. Public by necessity, so it
 * is rate limited per IP and returns the minimum: is it usable, and why not.
 * It does not reveal who owns a taken slug.
 */
export async function GET(request: NextRequest) {
  const ip = clientIpFrom(request.headers)
  const limit = await enforceLimit('slug', ip, SLUG_CHECK_RULES)
  if (!limit.allowed) {
    return NextResponse.json(
      { available: false, message: 'Too many checks. Wait a moment and keep typing.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfterSeconds ?? 60) } },
    )
  }

  const url = new URL(request.url)
  const rawSlug = url.searchParams.get('slug') ?? ''
  const name = url.searchParams.get('name') ?? ''

  // The form sends either a typed slug or just the name (to get a suggestion).
  const candidate = rawSlug ? rawSlug.trim().toLowerCase() : suggestSlug(name)

  if (!candidate) {
    return NextResponse.json({
      available: false,
      slug: '',
      suggestion: suggestSlug(name),
      message: 'Type a restaurant name or an address.',
    })
  }

  const shape = checkSlugShape(candidate)
  if (!shape.ok) {
    return NextResponse.json({
      available: false,
      slug: candidate.slice(0, SLUG_MAX),
      suggestion: rawSlug ? suggestSlug(name) : undefined,
      message: shape.reason,
    })
  }

  try {
    const taken = await getOne('SELECT id FROM businesses WHERE LOWER(slug) = $1 LIMIT 1', [shape.slug])
    if (taken) {
      // Offer a free variant rather than leaving the owner stranded.
      const suggestion = await suggestAvailable(shape.slug)
      return NextResponse.json({
        available: false,
        slug: shape.slug,
        suggestion,
        message: suggestion ? `Taken. ${suggestion} is free.` : 'That address is already taken.',
      })
    }
    return NextResponse.json({
      available: true,
      slug: shape.slug,
      preview: `foodbase.ng/${shape.slug}`,
    })
  } catch (error) {
    console.error('[slug-check] lookup failed', error)
    return NextResponse.json(
      { available: false, message: 'Could not check that address right now. You can still continue.' },
      { status: 200 },
    )
  }
}

/** Finds a nearby free slug: "jollof-house-2", "jollof-house-3", … */
async function suggestAvailable(slug: string): Promise<string | undefined> {
  for (let suffix = 2; suffix <= 6; suffix += 1) {
    const base = slug.slice(0, SLUG_MAX - String(suffix).length - 1).replace(/-$/, '')
    const candidate = `${base}-${suffix}`
    try {
      const hit = await getOne('SELECT id FROM businesses WHERE LOWER(slug) = $1 LIMIT 1', [candidate])
      if (!hit) return candidate
    } catch {
      return undefined
    }
  }
  return undefined
}
