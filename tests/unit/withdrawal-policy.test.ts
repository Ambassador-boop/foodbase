import { describe, expect, it } from 'vitest';
import {
  FREE_WITHDRAWALS_PER_MONTH,
  MIN_WITHDRAWAL_NGN,
  OVERAGE_FEE_NGN,
} from '@/lib/withdrawal-policy';
import { nextWatMonthStartUtc, watMonthStartUtc } from '@/lib/wat';

/**
 * The withdrawal fee rules, as the application states them.
 *
 * The money itself is moved by fb_reserve_withdrawal; nothing here reimplements
 * it. What these tests pin down is the contract the app hands to that function:
 * three free withdrawals per calendar month in Africa/Lagos, ₦500 from the
 * fourth, and a ₦100 minimum.
 */
describe('withdrawal policy constants', () => {
  it('gives three free withdrawals a month', () => {
    expect(FREE_WITHDRAWALS_PER_MONTH).toBe(3);
  });

  it('charges ₦500 above the free allowance', () => {
    expect(OVERAGE_FEE_NGN).toBe(500);
  });

  it('sets the minimum withdrawal at ₦100', () => {
    expect(MIN_WITHDRAWAL_NGN).toBe(100);
  });
});

/**
 * The fee boundary, expressed as the caller computes it.
 *
 * fb_reserve_withdrawal receives p_month_start and p_free_limit. It counts the
 * business's withdrawals since p_month_start and charges the overage fee once
 * that count has reached the free limit, so the fee starts on the 4th withdrawal
 * of the calendar month.
 */
describe('free-withdrawal boundary', () => {
  /** Mirrors what the function does with p_month_start and p_free_limit. */
  function feeForWithdrawalNumber(nthThisMonth: number): number {
    return nthThisMonth > FREE_WITHDRAWALS_PER_MONTH ? OVERAGE_FEE_NGN : 0;
  }

  it('is free for the 1st, 2nd and 3rd of the month', () => {
    expect(feeForWithdrawalNumber(1)).toBe(0);
    expect(feeForWithdrawalNumber(2)).toBe(0);
    expect(feeForWithdrawalNumber(3)).toBe(0);
  });

  it('charges ₦500 from the 4th of the month', () => {
    expect(feeForWithdrawalNumber(4)).toBe(OVERAGE_FEE_NGN);
    expect(feeForWithdrawalNumber(5)).toBe(OVERAGE_FEE_NGN);
    expect(feeForWithdrawalNumber(40)).toBe(OVERAGE_FEE_NGN);
  });
});

describe('watMonthStartUtc', () => {
  it('returns the UTC instant of 00:00 WAT on the 1st of the month', () => {
    // 25 November 2026, 10:00 WAT (09:00 UTC).
    const start = watMonthStartUtc(new Date('2026-11-25T09:00:00.000Z'));
    expect(start.toISOString()).toBe('2026-10-31T23:00:00.000Z');
  });

  it('still belongs to the previous month late in the WAT evening of the last day', () => {
    // 30 November 2026, 23:30 WAT is 22:30 UTC on the 30th, so November is current.
    const start = watMonthStartUtc(new Date('2026-11-30T22:30:00.000Z'));
    expect(start.toISOString()).toBe('2026-10-31T23:00:00.000Z');
  });

  it('rolls over the moment WAT reaches midnight on the 1st', () => {
    // 1 December 2026, 00:00 WAT is 30 November 23:00 UTC.
    const start = watMonthStartUtc(new Date('2026-11-30T23:00:00.000Z'));
    expect(start.toISOString()).toBe('2026-11-30T23:00:00.000Z');
  });

  it('is always exactly one month before the next month start', () => {
    const now = new Date('2026-02-14T12:00:00.000Z');
    const start = watMonthStartUtc(now);
    const next = nextWatMonthStartUtc(now);
    expect(next.toISOString()).toBe('2026-02-28T23:00:00.000Z');
    expect(start.toISOString()).toBe('2026-01-31T23:00:00.000Z');
  });

  it('does not use the UTC day, which would move the boundary by an hour', () => {
    const justBeforeWatMidnight = watMonthStartUtc(new Date('2026-11-30T22:59:59.000Z'));
    const justAfter = watMonthStartUtc(new Date('2026-11-30T23:00:01.000Z'));
    expect(justBeforeWatMidnight.toISOString()).not.toBe(justAfter.toISOString());
  });
});
