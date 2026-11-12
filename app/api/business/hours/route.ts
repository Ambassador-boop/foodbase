import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getActiveBusiness } from '@/lib/active-business'
import { getBusinessHours, saveBusinessHours, WEEK_ORDER, type DayHours } from '@/lib/business-hours'

/**
 * GET  /api/business/hours  → the owner's seven day rows + outside-hours policy
 * PUT  /api/business/hours  → replaces them (idempotent per weekday)
 *
 * Additive feature: no existing endpoint changes. The save also mirrors into
 * businesses.availability so the current storefront keeps working.
 */

export const runtime = 'nodejs'

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

function validateDays(input: unknown): { days: DayHours[] } | { error: string } {
  if (!Array.isArray(input) || input.length !== 7) return { error: 'Send all seven days.' }
  const days: DayHours[] = []
  const seen = new Set<number>()

  for (const raw of input) {
    const entry = raw as Record<string, unknown>
    const day = Number(entry?.day_of_week)
    if (!Number.isInteger(day) || day < 0 || day > 6) return { error: 'A weekday is out of range.' }
    if (seen.has(day)) return { error: 'Each weekday can only appear once.' }
    seen.add(day)

    const isClosed = entry?.is_closed === true
    const open = typeof entry?.open_time === 'string' ? entry.open_time.slice(0, 5) : null
    const close = typeof entry?.close_time === 'string' ? entry.close_time.slice(0, 5) : null

    if (!isClosed) {
      if (!open || !close) return { error: 'Every open day needs an opening and a closing time.' }
      if (!TIME_PATTERN.test(open) || !TIME_PATTERN.test(close)) return { error: 'Times must be in 24-hour HH:MM format.' }
      if (open === close) return { error: 'Opening and closing times cannot be the same.' }
    }

    days.push({
      day_of_week: day,
      is_closed: isClosed,
      open_time: isClosed ? null : open,
      close_time: isClosed ? null : close,
    })
  }

  if (seen.size !== 7) return { error: 'Send all seven days.' }
  // Normalise order so the caller always receives Monday-first.
  return { days: WEEK_ORDER.map((day) => days.find((entry) => entry.day_of_week === day)!) }
}

export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const business = await getActiveBusiness()
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

    const state = await getBusinessHours(business.id)
    return NextResponse.json({ success: true, ...state })
  } catch (error) {
    console.error('[hours] read failed', error)
    return NextResponse.json({ error: 'Could not load opening hours.' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user || user.role !== 'business_owner') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const business = await getActiveBusiness()
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

    const body = await request.json().catch(() => ({}))
    const checked = validateDays(body?.days)
    if ('error' in checked) return NextResponse.json({ error: checked.error }, { status: 422 })

    const acceptOutside = body?.accept_orders_outside_hours !== false
    const result = await saveBusinessHours(business.id, checked.days, acceptOutside)

    return NextResponse.json({
      success: true,
      days: checked.days,
      accept_orders_outside_hours: acceptOutside,
      // false means the additive table is not there yet and only the legacy JSON
      // mirror was written. The storefront still reflects the change.
      saved_to_hours_table: result.tableSaved,
    })
  } catch (error) {
    console.error('[hours] write failed', error)
    return NextResponse.json({ error: 'Could not save opening hours.' }, { status: 500 })
  }
}
