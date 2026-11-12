/**
 * Batch 3A-fix logic checks.
 *
 * Covers the rules behind "accept orders outside hours": the timezone shift,
 * the exact set of conditions that block an order, the next-opening copy, the
 * client mirror of the same rule, and the structure of the server gate itself.
 *
 * Run with:  npx tsx scripts/verify-batch-3a-fix.ts
 * No database, no network, no environment variables required.
 */

import { readFileSync } from 'node:fs'
import {
  DAY_LABELS,
  evaluateOrdering,
  formatTime12h,
  hasConfiguredHours,
  isOpenAt,
  isOrderingPaused,
  lagosNow,
  nextOpeningAt,
  type DayHours,
} from '@/lib/hours-shared'

let pass = 0
let fail = 0
function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) {
    pass++
    console.log('  ok  ' + name)
  } else {
    fail++
    console.log('FAIL  ' + name, extra ?? '')
  }
}

/** A week with the given open days, 09:00-21:00 unless stated. */
function week(openDays: number[], open = '09:00', close = '21:00'): DayHours[] {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => ({
    day_of_week: day,
    is_closed: !openDays.includes(day),
    open_time: openDays.includes(day) ? open : null,
    close_time: openDays.includes(day) ? close : null,
  }))
}

/**
 * A Date whose local fields read as the given Lagos wall-clock time, whichever
 * timezone this process runs in. That is what every gate and preview receives,
 * so the whole suite is timezone independent: run it with TZ=UTC, TZ=Africa/
 * Lagos or TZ=America/New_York and the answers must be identical.
 */
function lagosAt(day: number, hour: number, minute = 0): Date {
  const wall = new Date(Date.UTC(2026, 10, 8, 0, 0, 0)) // Sunday 8 Nov 2026
  wall.setUTCDate(wall.getUTCDate() + day)
  wall.setUTCHours(hour, minute, 0, 0)
  // `wall` is the Lagos clock written as if it were UTC; the real instant is an
  // hour earlier, and lagosNow shifts it back to that wall clock.
  return lagosNow(new Date(wall.getTime() - 60 * 60000))
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

console.log('\nTIMEZONE')
{
  // Whatever this runtime's zone is, lagosNow must read one hour ahead of UTC.
  const instant = new Date('2026-11-12T08:00:00Z')
  const lagos = lagosNow(instant)
  ok('lagosNow shifts UTC to UTC+1 (08:00Z -> 09:00)', lagos.getHours() === 9 && lagos.getMinutes() === 0, lagos.toString())
  ok(
    'lagosNow shifts by exactly one hour, in the runtime\'s own zone',
    lagos.getTime() - instant.getTime() === (instant.getTimezoneOffset() + 60) * 60000,
    lagos.getTime() - instant.getTime(),
  )
  ok('lagosNow does not mutate its input', instant.getUTCHours() === 8)
  const late = lagosNow(new Date('2026-11-12T23:30:00Z'))
  ok('lagosNow rolls the weekday past 23:00Z', late.getDay() === 5 && late.getHours() === 0, late.toString())
}

console.log('\nOPEN / CLOSED ARITHMETIC')
{
  const days = week(ALL_DAYS)
  ok('09:00-21:00 open at 11:00', isOpenAt(days, lagosAt(4, 11)))
  ok('09:00-21:00 closed at 08:59', !isOpenAt(days, lagosAt(4, 8, 59)))
  ok('09:00-21:00 closed at 21:00 exactly', !isOpenAt(days, lagosAt(4, 21)))
  ok('09:00-21:00 open at 20:59', isOpenAt(days, lagosAt(4, 20, 59)))
}

console.log('\nPAST MIDNIGHT')
{
  // Thursday 18:00-02:00. Friday morning's early hours belong to Thursday.
  const days = week(ALL_DAYS, '18:00', '02:00')
  ok('open at 19:00', isOpenAt(days, lagosAt(4, 19)))
  ok('open at 01:30 (window from yesterday)', isOpenAt(days, lagosAt(5, 1, 30)))
  ok('closed at 03:00', !isOpenAt(days, lagosAt(5, 3)))
  ok('closed at 12:00', !isOpenAt(days, lagosAt(5, 12)))

  // 02:30 on Friday: Thursday's window ended at 02:00, Friday's starts at 18:00.
  const decision = evaluateOrdering(days, false, lagosAt(5, 2, 30))
  ok('past-midnight + setting off blocks at 02:30', decision.allowed === false)
  ok('past-midnight next opening is Friday 6:00 PM', decision.opensAt === 'Opens today at 6:00 PM', decision.opensAt)

  const stillOpen = evaluateOrdering(days, false, lagosAt(5, 1, 30))
  ok('past-midnight + setting off allows at 01:30', stillOpen.allowed === true)
  ok('no opensAt when open', stillOpen.opensAt === null)
}

console.log('\nSERVER DECISION (the only four cases)')
{
  const openWeek = week(ALL_DAYS)

  // 1. Open now.
  const open = evaluateOrdering(openWeek, false, lagosAt(4, 11))
  ok('open + setting off -> allowed', open.allowed === true)
  ok('open + setting off -> openNow true', open.openNow === true)
  ok('open + setting off -> no opensAt', open.opensAt === null)

  // 2. Closed, setting ON (the default) -> allowed, exactly as today.
  const closedSettingOn = evaluateOrdering(openWeek, true, lagosAt(4, 23))
  ok('closed + setting on -> allowed', closedSettingOn.allowed === true)
  ok('closed + setting on -> reports openNow false', closedSettingOn.openNow === false)
  ok('closed + setting on -> opensAt is human readable', closedSettingOn.opensAt === 'Opens tomorrow at 9:00 AM', closedSettingOn.opensAt)

  // 3. Closed, setting OFF -> blocked with the next opening.
  const closedSettingOff = evaluateOrdering(openWeek, false, lagosAt(4, 23))
  ok('closed + setting off -> blocked', closedSettingOff.allowed === false)
  ok('closed + setting off -> opensAt "Opens tomorrow at 9:00 AM"', closedSettingOff.opensAt === 'Opens tomorrow at 9:00 AM', closedSettingOff.opensAt)

  // 4. Hours never configured -> allowed, whatever the setting says.
  const noHours = week([])
  ok('no hours -> hasConfiguredHours false', hasConfiguredHours(noHours) === false)
  const unconfiguredOff = evaluateOrdering(noHours, false, lagosAt(4, 23))
  ok('no hours + setting off -> allowed', unconfiguredOff.allowed === true)
  ok('no hours + setting off -> hoursConfigured false', unconfiguredOff.hoursConfigured === false)
  const nullDays = evaluateOrdering(null, false, lagosAt(4, 23))
  ok('null days + setting off -> allowed', nullDays.allowed === true)
  const partial = evaluateOrdering([{ day_of_week: 4, is_closed: false, open_time: '09:00', close_time: null }], false, lagosAt(4, 23))
  ok('half-filled day counts as unconfigured -> allowed', partial.allowed === true)

  // Setting ON must never block, on any day or hour.
  let blockedWhileOn = 0
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      if (!evaluateOrdering(openWeek, true, lagosAt(day, hour, 30)).allowed) blockedWhileOn++
    }
  }
  ok('setting on: 168 hourly checks never block', blockedWhileOn === 0, blockedWhileOn)

  // Setting OFF must block precisely the hours outside the window (09:00-21:00).
  let blockedWhileOff = 0
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      if (!evaluateOrdering(openWeek, false, lagosAt(day, hour, 30)).allowed) blockedWhileOff++
    }
  }
  ok('setting off: blocks exactly the 12 closed hours per day', blockedWhileOff === 84, blockedWhileOff)
}

console.log('\nNEXT OPENING COPY')
{
  const days = week([1, 2, 3, 4, 5], '09:00', '18:00')
  const beforeWork = nextOpeningAt(days, lagosAt(4, 7))
  ok('same day: "Opens today at 9:00 AM"', beforeWork?.label === 'Opens today at 9:00 AM', beforeWork)
  const afterClose = nextOpeningAt(days, lagosAt(4, 19))
  ok('next day: "Opens tomorrow at 9:00 AM"', afterClose?.label === 'Opens tomorrow at 9:00 AM', afterClose)
  const fridayNight = nextOpeningAt(days, lagosAt(5, 23))
  ok('weekend: "Opens Monday at 9:00 AM"', fridayNight?.label === 'Opens Monday at 9:00 AM', fridayNight)
  ok('Friday night next opening is 3 days away (Monday)', fridayNight?.dayOffset === 3, fridayNight)
  const sundayOnly = nextOpeningAt(week([0], '12:00', '16:00'), lagosAt(3, 10))
  ok('single open day: names the weekday', sundayOnly?.label === 'Opens Sunday at 12:00 PM', sundayOnly)
  ok('no hours -> no next opening', nextOpeningAt(week([]), lagosAt(3, 10)) === null)
  ok('formatTime12h 00:00 is 12:00 AM', formatTime12h('00:00') === '12:00 AM')
  ok('formatTime12h 12:00 is 12:00 PM', formatTime12h('12:00') === '12:00 PM')
  ok('formatTime12h 09:05 pads', formatTime12h('09:05') === '9:05 AM', formatTime12h('09:05'))
  ok('formatTime12h 21:30 is 9:30 PM', formatTime12h('21:30') === '9:30 PM')
  ok('formatTime12h empty for null', formatTime12h(null) === '')
  ok('every weekday label is reachable', DAY_LABELS.length === 7)
}

console.log('\nCLIENT MIRROR (isOrderingPaused)')
{
  const base = { isOpenNow: false, acceptOrdersOutsideHours: false, hoursConfigured: true }
  ok('closed + setting off -> paused', isOrderingPaused(base) === true)
  ok('closed + setting on -> not paused', isOrderingPaused({ ...base, acceptOrdersOutsideHours: true }) === false)
  ok('open + setting off -> not paused', isOrderingPaused({ ...base, isOpenNow: true }) === false)
  ok('no hours + setting off -> not paused', isOrderingPaused({ ...base, hoursConfigured: false }) === false)
  ok('missing hours payload -> not paused', isOrderingPaused(null) === false)
  ok('undefined -> not paused', isOrderingPaused(undefined) === false)
  // Older payloads without hoursConfigured fall back to the days array.
  ok('legacy payload, all closed -> not paused', isOrderingPaused({ days: week([]), isOpenNow: false, acceptOrdersOutsideHours: false }) === false)
  ok('legacy payload, real schedule -> paused', isOrderingPaused({ days: week(ALL_DAYS), isOpenNow: false, acceptOrdersOutsideHours: false }) === true)

  // Client and server must always agree.
  const days = week([1, 2, 3, 4, 5], '09:00', '18:00')
  let disagreements = 0
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      const now = lagosAt(day, hour, 30)
      const server = evaluateOrdering(days, false, now)
      const client = isOrderingPaused({
        days,
        isOpenNow: isOpenAt(days, now),
        acceptOrdersOutsideHours: false,
        hoursConfigured: hasConfiguredHours(days),
      })
      if (server.allowed === client) disagreements++
    }
  }
  ok('client and server agree on all 168 hourly checks', disagreements === 0, disagreements)
}

console.log('\nSERVER GATE (source structure)')
{
  const route = readFileSync('app/api/orders/route.ts', 'utf8')
  const gateIndex = route.indexOf('getOrderingStatus(cleanBusinessId)')
  const pricingIndex = route.indexOf('Server-side re-pricing')
  const insertIndex = route.indexOf('INSERT INTO orders')
  ok('gate exists in the order route', gateIndex > -1)
  ok('gate runs after business verification', route.indexOf('Business verified') < gateIndex)
  ok('gate runs before any pricing', gateIndex > -1 && gateIndex < pricingIndex)
  ok('gate runs before any insert', gateIndex > -1 && (insertIndex === -1 || gateIndex < insertIndex))
  ok('returns 409', /RESTAURANT_CLOSED[\s\S]{0,200}?status: 409|status: 409[\s\S]{0,200}?RESTAURANT_CLOSED/.test(route.slice(gateIndex, gateIndex + 900)))
  ok('uses the agreed error copy', route.includes("'This restaurant is not taking orders right now.'"))
  ok('returns the next opening as opensAt', route.includes('opensAt: ordering.opensAt'))
  ok('a thrown hours error allows the order', /catch \(hoursError\)[\s\S]{0,160}allowing the order/.test(route))

  const menu = readFileSync('app/api/restaurants/[slug]/menu/route.ts', 'utf8')
  ok('menu payload exposes hoursConfigured', menu.includes('hoursConfigured: hasConfiguredHours(hoursState.days)'))
  ok('menu payload exposes opensAt', menu.includes('opensAt: isOpenNow ? null : nextOpeningAt(hoursState.days, now)?.label ?? null'))
  ok('menu uses the Lagos clock', menu.includes('const now = lagosNow()'))

  const checkout = readFileSync('app/[slug]/checkout/page.tsx', 'utf8')
  ok('checkout handles RESTAURANT_CLOSED from the server', checkout.includes("orderData?.code === 'RESTAURANT_CLOSED'"))
  ok('checkout disables the pay button', checkout.includes('disabled={loading || orderingPaused}'))
  ok('checkout shows the notice', checkout.includes('<OrderingPausedNotice'))

  const cart = readFileSync('app/[slug]/cart/page.tsx', 'utf8')
  ok('cart shows the notice', cart.includes('<OrderingPausedNotice'))
  ok('cart disables checkout', cart.includes('disabled={orderingPaused}'))
  ok('cart keeps quantity editing untouched', cart.includes('onIncrement') && cart.includes('onDecrement'))

  const editor = readFileSync('components/dashboard/hours-editor.tsx', 'utf8')
  ok('editor has the live preview line', editor.includes('Customers will see'))
  ok('editor states already-placed orders are unaffected', /already placed are never affected/.test(editor))
  ok('editor preview uses the Lagos clock', editor.includes('lagosNow()'))

  const rootLayout = readFileSync('app/layout.tsx', 'utf8')
  ok('root layout no longer loads Instrument Serif', !rootLayout.includes('Instrument_Serif'))
  ok('root layout no longer loads Instrument Sans', !rootLayout.includes('Instrument_Sans'))
  ok('root layout keeps Plus Jakarta Sans', rootLayout.includes('Plus_Jakarta_Sans'))
  const dashLayout = readFileSync('app/dashboard/layout.tsx', 'utf8')
  ok(
    'dashboard layout loads the pairing',
    dashLayout.includes('editorialFontClassName') && dashLayout.includes('useEditorialFontRoot()'),
  )
  ok('admin layout loads the pairing', readFileSync('app/admin/layout.tsx', 'utf8').includes('EditorialFontScope'))
  ok('register layout loads the pairing', readFileSync('app/register/layout.tsx', 'utf8').includes('EditorialFontScope'))
  const fonts = readFileSync('lib/editorial-fonts.tsx', 'utf8')
  ok('variable names unchanged', fonts.includes("'--font-editorial'") && fonts.includes("'--font-dashboard-ui'"))
}

console.log(`\n${pass} passed, ${fail} failed\n`)
if (fail > 0) process.exit(1)
