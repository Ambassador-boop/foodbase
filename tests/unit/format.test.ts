import { describe, expect, it } from 'vitest'

import { formatDate, formatDateTime, formatNaira, isZeroAmount, splitNaira } from '@/lib/format'

/**
 * The money formatter is the one piece of this batch that touches what a
 * customer is charged and told they earned, so it is tested rather than eyeballed.
 *
 * The cases that matter:
 *  - NUMERIC arrives from Postgres as a string, and must never be routed through
 *    a float (0.1 + 0.2, and anything past 2^53).
 *  - a debit reads as one negative quantity: -₦1,200.00, not ₦-1,200.00.
 *  - kobo are rounded half away from zero, and 999.995 must carry into 1,000.00.
 */
describe('formatNaira', () => {
  it('formats the four reference amounts', () => {
    expect(formatNaira('0')).toBe('₦0.00')
    expect(formatNaira('1000')).toBe('₦1,000.00')
    expect(formatNaira('1234567.89')).toBe('₦1,234,567.89')
    expect(formatNaira('-1200')).toBe('-₦1,200.00')
  })

  it('puts the minus sign before the Naira sign', () => {
    expect(formatNaira('-1200.5')).toBe('-₦1,200.50')
    expect(formatNaira(-1200)).toBe('-₦1,200.00')
  })

  it('never routes a stored value through a float', () => {
    // Larger than Number.MAX_SAFE_INTEGER: a float would lose the last digits.
    expect(formatNaira('999999999999999999999.99')).toBe('₦999,999,999,999,999,999,999.99')
    expect(formatNaira('0.1')).toBe('₦0.10')
    expect(formatNaira('0.07')).toBe('₦0.07')
  })

  it('rounds kobo half away from zero and carries', () => {
    expect(formatNaira('999.994')).toBe('₦999.99')
    expect(formatNaira('999.995')).toBe('₦1,000.00')
    expect(formatNaira('0.005')).toBe('₦0.01')
    expect(formatNaira('-0.005')).toBe('-₦0.01')
  })

  it('accepts a number, a bigint and a pre-formatted string', () => {
    expect(formatNaira(1200.5)).toBe('₦1,200.50')
    expect(formatNaira(BigInt('5000'))).toBe('₦5,000.00')
    expect(formatNaira('₦1,200.00')).toBe('₦1,200.00')
  })

  it('treats an absent value as zero rather than NaN', () => {
    expect(formatNaira(null)).toBe('₦0.00')
    expect(formatNaira(undefined)).toBe('₦0.00')
    expect(formatNaira('')).toBe('₦0.00')
    expect(formatNaira('not a number')).toBe('₦0.00')
  })

  it('honours the display options', () => {
    expect(formatNaira('1200', { symbol: false })).toBe('1,200.00')
    expect(formatNaira('1200', { decimals: 0 })).toBe('₦1,200')
    expect(formatNaira('1200', { signed: true })).toBe('+₦1,200.00')
    // Zero is never signed: "+₦0.00" reads as a change that did not happen.
    expect(formatNaira('0', { signed: true })).toBe('₦0.00')
  })
})

describe('splitNaira', () => {
  it('separates sign, symbol and digits', () => {
    expect(splitNaira('-1234.5')).toEqual({
      sign: '-',
      symbol: '₦',
      whole: '1,234',
      fraction: '50',
    })
  })
})

describe('isZeroAmount', () => {
  it('is true only for an exact zero', () => {
    expect(isZeroAmount('0.00')).toBe(true)
    expect(isZeroAmount('-0.00')).toBe(true)
    expect(isZeroAmount('0.01')).toBe(false)
  })
})

describe('formatDate and formatDateTime', () => {
  it('reads dates in Africa/Lagos', () => {
    expect(formatDate('2026-12-30')).toBe('30 Dec 2026')
    // 23:30 UTC is already the next day in Lagos (UTC+1).
    expect(formatDateTime('2026-12-30T23:30:00Z')).toBe('31 Dec 2026, 12:30 am')
    expect(formatDateTime('2026-12-30T15:30:00Z')).toBe('30 Dec 2026, 4:30 pm')
  })

  it('returns an em dash for nothing usable', () => {
    expect(formatDate(null)).toBe('—')
    expect(formatDate('')).toBe('—')
    expect(formatDateTime('not a date')).toBe('—')
  })
})
