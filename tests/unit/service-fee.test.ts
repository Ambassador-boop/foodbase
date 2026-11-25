import { describe, expect, it } from 'vitest';
import { calculateServiceFee, getDefaultServiceFeeConfig } from '@/lib/service-fee';

/**
 * The service fee is the platform's own revenue, so the ladder is worth pinning
 * down exactly: nothing below ₦1,000, a fixed step per tier, and ₦100 for every
 * full ₦10,000 above ₦30,000.
 */
describe('calculateServiceFee', () => {
  const config = getDefaultServiceFeeConfig();

  it('charges nothing on a zero basket', () => {
    expect(calculateServiceFee(0, config)).toBe(0);
  });

  it('charges nothing below the first tier', () => {
    expect(calculateServiceFee(999, config)).toBe(0);
    expect(calculateServiceFee(1, config)).toBe(0);
  });

  it('charges the first tier exactly at its boundary', () => {
    expect(calculateServiceFee(1000, config)).toBe(100);
  });

  it('charges each tier from its threshold', () => {
    expect(calculateServiceFee(2999, config)).toBe(100);
    expect(calculateServiceFee(3000, config)).toBe(200);
    expect(calculateServiceFee(6999, config)).toBe(200);
    expect(calculateServiceFee(7000, config)).toBe(300);
    expect(calculateServiceFee(14999, config)).toBe(300);
    expect(calculateServiceFee(15000, config)).toBe(500);
    expect(calculateServiceFee(21999, config)).toBe(500);
    expect(calculateServiceFee(22000, config)).toBe(700);
    expect(calculateServiceFee(29999, config)).toBe(700);
  });

  it('adds ₦100 for every full ₦10,000 above ₦30,000', () => {
    expect(calculateServiceFee(30000, config)).toBe(1000);
    expect(calculateServiceFee(39999, config)).toBe(1000);
    expect(calculateServiceFee(40000, config)).toBe(1100);
    expect(calculateServiceFee(50000, config)).toBe(1200);
    expect(calculateServiceFee(100000, config)).toBe(1700);
  });

  it('stays exact on a very large basket', () => {
    // 1,000,000 is 970,000 above 30,000: 97 whole blocks of 10,000.
    expect(calculateServiceFee(1_000_000, config)).toBe(1000 + 97 * 100);
  });

  it('returns zero when the config is empty rather than guessing', () => {
    expect(calculateServiceFee(5000, [])).toBe(0);
  });

  it('uses the highest matching tier when the config is unsorted', () => {
    const shuffled = [...config].reverse();
    expect(calculateServiceFee(7500, shuffled)).toBe(300);
  });

  it('ignores tiers above the basket', () => {
    const onlyHighTiers = config.filter((tier) => tier.tier_value >= 15000);
    expect(calculateServiceFee(5000, onlyHighTiers)).toBe(0);
  });
});

describe('getDefaultServiceFeeConfig', () => {
  it('is the documented ladder', () => {
    expect(getDefaultServiceFeeConfig().map((tier) => [tier.tier_value, tier.service_fee])).toEqual([
      [1000, 100],
      [3000, 200],
      [7000, 300],
      [15000, 500],
      [22000, 700],
      [30000, 1000],
    ]);
  });

  it('returns a fresh copy each time, so a caller cannot mutate the defaults', () => {
    const first = getDefaultServiceFeeConfig();
    first[0].service_fee = 999999;
    expect(getDefaultServiceFeeConfig()[0].service_fee).toBe(100);
  });
});
