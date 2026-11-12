import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getActiveBusiness } from '@/lib/active-business'
import { query } from '@/lib/db'
import { buildOnboarding, SKIPPABLE, type OnboardingStepKey } from '@/lib/onboarding'
import { generateId } from '@/lib/utils-extended'

/**
 * GET /api/business/onboarding
 *   Everything the checklist and the dashboard card need, computed from real data.
 *
 * POST /api/business/onboarding  { step_key, skip }
 *   Records (or clears) the owner's decision to skip a non-critical step.
 *   No step ever blocks the dashboard, so this is the only write.
 */

export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const business = await getActiveBusiness()
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

    const summary = await buildOnboarding(business, String(user.id))
    return NextResponse.json({
      success: true,
      business: {
        id: business.id,
        name: business.name,
        slug: business.slug,
        is_active: business.is_active,
      },
      ...summary,
    })
  } catch (error) {
    console.error('[onboarding] read failed', error)
    return NextResponse.json({ error: 'Could not load your setup checklist.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const business = await getActiveBusiness()
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const stepKey = String(body?.step_key ?? '')
    const skip = body?.skip !== false

    if (!SKIPPABLE.includes(stepKey as OnboardingStepKey)) {
      return NextResponse.json({ error: 'That step cannot be skipped.' }, { status: 400 })
    }

    try {
      if (skip) {
        await query(
          `INSERT INTO onboarding_skips (id, business_id, step_key)
           VALUES ($1, $2, $3)
           ON CONFLICT (business_id, step_key) DO NOTHING`,
          [generateId('os'), business.id, stepKey],
        )
      } else {
        await query('DELETE FROM onboarding_skips WHERE business_id = $1 AND step_key = $2', [business.id, stepKey])
      }
    } catch (error) {
      // Table not migrated yet. Skipping is a convenience, not a requirement.
      console.warn('[onboarding] skip not stored', error)
      return NextResponse.json({
        success: false,
        degraded: true,
        message: 'Your checklist is saved automatically. This preference could not be stored yet.',
      })
    }

    const summary = await buildOnboarding(business, String(user.id))
    return NextResponse.json({ success: true, ...summary })
  } catch (error) {
    console.error('[onboarding] write failed', error)
    return NextResponse.json({ error: 'Could not update the checklist.' }, { status: 500 })
  }
}
