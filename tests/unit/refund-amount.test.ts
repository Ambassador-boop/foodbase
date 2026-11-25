import { describe, expect, it } from 'vitest';
import { refundAmountKobo, refundAmountNaira, refundAmountSource } from '@/lib/refund-amount';

/**
 * The refunds table stores the same figure in two units: refund_amount in naira
 * and the legacy amount in kobo. Reading the wrong one is a 100x error, so every
 * case below is really asking "did we pick the right column, and the right unit".
 */
describe('refundAmountNaira', () => {
  it('returns zero for nothing at all', () => {
    expect(refundAmountNaira(null)).toBe(0);
    expect(refundAmountNaira(undefined)).toBe(0);
    expect(refundAmountNaira({})).toBe(0);
  });

  it('prefers refund_amount and treats it as naira', () => {
    expect(refundAmountNaira({ refund_amount: 2500, amount: 999999 })).toBe(2500);
  });

  it('treats a stored zero as a real amount, not as missing', () => {
    expect(refundAmountNaira({ refund_amount: 0, amount: 50000 })).toBe(0);
    expect(refundAmountSource({ refund_amount: 0, amount: 50000 })).toBe('refund_amount');
  });

  it('converts the legacy kobo column when refund_amount is absent', () => {
    expect(refundAmountNaira({ amount: 250000 })).toBe(2500);
    expect(refundAmountNaira({ amount: 1 })).toBe(0.01);
    expect(refundAmountSource({ amount: 250000 })).toBe('amount');
  });

  it('accepts numeric strings, which is what the driver returns for numeric columns', () => {
    expect(refundAmountNaira({ refund_amount: '1500.50' })).toBe(1500.5);
    expect(refundAmountNaira({ amount: '150050' })).toBe(1500.5);
  });

  it('rounds to two decimals', () => {
    expect(refundAmountNaira({ refund_amount: 10.005 })).toBe(10.01);
    expect(refundAmountNaira({ refund_amount: 0.1 + 0.2 })).toBe(0.3);
  });

  it('ignores values that are not numbers', () => {
    expect(refundAmountNaira({ refund_amount: 'abc' })).toBe(0);
    expect(refundAmountNaira({ refund_amount: '', amount: 1000 })).toBe(10);
    expect(refundAmountSource({ refund_amount: 'abc' })).toBe('none');
  });

  it('keeps a very large refund exact', () => {
    expect(refundAmountNaira({ refund_amount: 123456789.99 })).toBe(123456789.99);
  });

  it('handles a partial refund: the stored figure is the part refunded', () => {
    // A ₦10,000 payment refunded in part: only 2,500 comes back.
    expect(refundAmountNaira({ refund_amount: 2500 })).toBe(2500);
  });

  it('does not clamp a refund larger than the payment: that is the SQL function’s call', () => {
    // fb_request_refund is the only place that refuses an over-refund. This
    // reader reports what is stored, and the report flags that the API does not
    // pre-check it.
    expect(refundAmountNaira({ refund_amount: 12000 })).toBe(12000);
  });
});

describe('refundAmountKobo', () => {
  it('converts naira to whole kobo', () => {
    expect(refundAmountKobo({ refund_amount: 2500 })).toBe(250000);
    expect(refundAmountKobo({ refund_amount: 0.01 })).toBe(1);
    expect(refundAmountKobo({ refund_amount: 1500.5 })).toBe(150050);
  });

  it('never returns a fraction of a kobo', () => {
    expect(Number.isInteger(refundAmountKobo({ refund_amount: 10.005 }))).toBe(true);
  });

  it('is zero when there is no amount', () => {
    expect(refundAmountKobo(null)).toBe(0);
  });

  it('rounds the legacy column back to the same naira figure', () => {
    const refund = { amount: 250000 };
    expect(refundAmountKobo(refund)).toBe(refundAmountNaira(refund) * 100);
  });
});
