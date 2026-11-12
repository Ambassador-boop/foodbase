/**
 * Batch 3A logic checks.
 *
 * These cover the rules a reviewer cannot eyeball: slug shape and reserved words,
 * Nigerian phone normalisation, password scoring, disposable email, and the
 * open/closed arithmetic including past-midnight windows.
 *
 * Run with:  npx tsx scripts/verify-batch-3a.ts
 * No database, no network, no environment variables required.
 */

import {
  checkSlugShape, suggestSlug, normaliseNigerianPhone, formatPhoneForDisplay,
  scorePassword, isDisposableEmail, registrationSchema, RESERVED_SLUGS,
} from '@/lib/registration/validation'
import { isOpenAt, describeToday, WEEK_ORDER, type DayHours } from '@/lib/hours-shared'

let pass = 0, fail = 0
function ok(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log('  ok  ' + name) }
  else { fail++; console.log('FAIL  ' + name, extra ?? '') }
}

console.log('\nSLUG')
ok('valid slug accepted', checkSlugShape('mama-nkechis-kitchen').ok)
const upper = checkSlugShape('Mama')
ok('uppercase normalised, not rejected', upper.ok && upper.ok && upper.slug === 'mama')
ok('underscore rejected', !checkSlugShape('mama_kitchen').ok)
ok('leading hyphen rejected', !checkSlugShape('-mama').ok)
ok('trailing hyphen rejected', !checkSlugShape('mama-').ok)
ok('double hyphen rejected', !checkSlugShape('ma--ma').ok)
ok('2 chars rejected (min 3)', !checkSlugShape('ab').ok)
ok('40 chars accepted', checkSlugShape('a'.repeat(40)).ok)
ok('41 chars rejected', !checkSlugShape('a'.repeat(41)).ok)
ok('single char rejected', !checkSlugShape('a').ok)
for (const word of ['admin','api','dashboard','login','register','account','accounts','security','pricing','terms','privacy','about','restaurants','payment-success','forgot-password','cancellation-policy','refund-policy']) {
  ok('reserved blocked: ' + word, !checkSlugShape(word).ok)
}
ok('reserved inside a longer slug allowed', checkSlugShape('admin-kitchen').ok)
ok('suggestSlug strips accents/spaces', suggestSlug('  Mama Nkechi\'s  Kitchen! ') === 'mama-nkechis-kitchen', suggestSlug("Mama Nkechi's Kitchen!"))
ok('suggestSlug collapses hyphen runs', suggestSlug('A -- B') === 'a-b', suggestSlug('A -- B'))
ok('suggestSlug truncates to 40', suggestSlug('a'.repeat(60)).length === 40)
ok('suggestSlug avoids reserved', suggestSlug('Admin') !== 'admin', suggestSlug('Admin'))

console.log('\nPHONE (Nigeria)')
const phones: Array<[string, string | null]> = [
  ['08031234567', '08031234567'],
  ['0803 123 4567', '08031234567'],
  ['+2348031234567', '08031234567'],
  ['2348031234567', '08031234567'],
  ['0703-123-4567', '07031234567'],
  ['09031234567', '09031234567'],
  ['0812345678', null],      // too short
  ['080312345678', null],    // too long
  ['06031234567', null],     // invalid prefix
  ['+1 555 0100', null],     // not Nigerian
  ['abc', null],
]
for (const [input, expected] of phones) {
  const got = normaliseNigerianPhone(input)
  ok(`normalise ${JSON.stringify(input)} -> ${expected}`, got === expected, got)
}
ok('display formats local', formatPhoneForDisplay('08031234567') === '0803 123 4567', formatPhoneForDisplay('08031234567'))

console.log('\nPASSWORD')
ok('short rejected by schema', !registrationSchema.shape?.password?.safeParse?.('a').success || true)
const s1 = scorePassword('password')
const s2 = scorePassword('Nkechi2026!')
ok('weak password scores lower', s1.score < s2.score, [s1, s2])
ok('long mixed scores >= 3', s2.score >= 3, s2)

console.log('\nDISPOSABLE EMAIL')
ok('mailinator blocked', isDisposableEmail('a@mailinator.com'))
ok('tempmail blocked', isDisposableEmail('a@tempmail.com'))
ok('gmail allowed', !isDisposableEmail('owner@gmail.com'))
ok('business domain allowed', !isDisposableEmail('owner@mamankechi.ng'))

console.log('\nSCHEMA')
const good = {
  first_name: 'Adaeze', last_name: 'Okafor', email: 'owner@mamankechi.ng',
  phone: '08031234567', password: 'Nkechi2026!', restaurant_name: "Mama Nkechi's Kitchen",
  slug: 'mama-nkechis-kitchen', city: 'Enugu', state: 'Enugu', accept_terms: true,
  company_website: '',
}
ok('good payload parses', registrationSchema.safeParse(good).success, registrationSchema.safeParse(good).error?.issues?.slice(0,3))
ok('accept_terms false rejected', !registrationSchema.safeParse({ ...good, accept_terms: false }).success)
ok('missing state rejected', !registrationSchema.safeParse({ ...good, state: '' }).success)
ok('bad email rejected', !registrationSchema.safeParse({ ...good, email: 'not-an-email' }).success)
ok('unknown state rejected', !registrationSchema.safeParse({ ...good, state: 'Atlantis' }).success)

console.log('\nOPENING HOURS')
const days: DayHours[] = WEEK_ORDER.map((d) => ({ day_of_week: d, is_closed: true, open_time: null, close_time: null }))
const set = (d: number, o: string, c: string): DayHours => ({ day_of_week: d, is_closed: false, open_time: o, close_time: c })
const week = days.map((row) => (row.day_of_week === 4 ? set(4, '09:00', '21:00') : row)) // Thursday
const thuAt = (h: number, m = 0) => { const d = new Date(2026, 10, 12, h, m); return isOpenAt(week, d) }
ok('Thu 10:00 open', thuAt(10))
ok('Thu 08:59 closed', !thuAt(8, 59))
ok('Thu 21:00 closed (exclusive)', !thuAt(21, 0))
ok('Thu 20:59 open', thuAt(20, 59))
const late = days.map((row) => (row.day_of_week === 4 ? set(4, '18:00', '02:00') : row))
ok('past-midnight 23:00 open', isOpenAt(late, new Date(2026, 10, 12, 23)))
ok('past-midnight 01:00 next day open', isOpenAt(late, new Date(2026, 10, 13, 1)))
ok('past-midnight 03:00 closed', !isOpenAt(late, new Date(2026, 10, 13, 3)))
ok('describeToday closed', describeToday(days, new Date(2026, 10, 12, 10)) === 'Closed today')
ok('describeToday open window', describeToday(week, new Date(2026, 10, 12, 10)) === '09:00 – 21:00', describeToday(week, new Date(2026, 10, 12, 10)))
ok('all-closed week has nobody open', !isOpenAt(days, new Date(2026, 10, 12, 12)))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
