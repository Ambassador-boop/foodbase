import { describe, expect, it } from 'vitest';
import { DELIVERY_FEE, DRINK_ID_PREFIX, round2 } from '@/lib/pricing';

/**
 * lib/pricing.ts is imported by both the checkout page and the orders route, so
 * these values are the contract between what a customer sees and what they are
 * charged.
 */
describe('pricing constants', () => {
  it('charges a flat ₦1,000 delivery fee as the legacy default', () => {
    expect(DELIVERY_FEE).toBe(1000);
  });

  it('prefixes drink ids so they cannot collide with menu item ids', () => {
    expect(DRINK_ID_PREFIX).toBe('drink_');
  });
});

describe('round2', () => {
  it('leaves whole numbers alone', () => {
    expect(round2(1000)).toBe(1000);
    expect(round2(0)).toBe(0);
  });

  it('fixes binary floating point drift', () => {
    expect(round2(0.1 + 0.2)).toBe(0.3);
  });

  it('rounds the values that arrive from the database correctly', () => {
    expect(round2(10.125)).toBe(10.13);
    expect(round2(10.135)).toBe(10.14);
  });

  it('is subject to the usual float edge at an exact half-kobo', () => {
    // 1.005 is stored as 1.00499999..., so it rounds down. Recorded rather than
    // fixed: changing round2 would change displayed and charged amounts, which
    // this batch does not do. Flagged in the report.
    expect(round2(1.005)).toBe(1);
    // 2.675 is stored as 2.67500000000000004, so this one rounds up.
    expect(round2(2.675)).toBe(2.68);
  });

  it('rounds to two decimals, not one', () => {
    expect(round2(10.004)).toBe(10);
    expect(round2(10.005)).toBe(10.01);
    expect(round2(10.006)).toBe(10.01);
  });

  it('handles negative amounts used in adjustments', () => {
    expect(round2(-10.005)).toBe(-10.01);
    expect(round2(-0.001)).toBe(-0);
  });

  it('returns zero for values that are not finite', () => {
    expect(round2(Number.NaN)).toBe(0);
    expect(round2(Number.POSITIVE_INFINITY)).toBe(0);
    expect(round2(Number.NEGATIVE_INFINITY)).toBe(0);
  });

  it('keeps very large amounts exact to the kobo', () => {
    expect(round2(999999999.995)).toBe(1000000000);
    expect(round2(123456789.125)).toBe(123456789.13);
  });

  it('sums a basket the way the page does, without drift', () => {
    const lines = [0.1, 0.2, 0.3, 1499.99];
    const subtotal = round2(lines.reduce((total, line) => total + line, 0));
    expect(subtotal).toBe(1500.59);
  });
});
