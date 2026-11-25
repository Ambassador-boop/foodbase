import { describe, expect, it } from 'vitest';
import {
  PAYSTACK_TRANSFER_FEES,
  providerTransferFeeNaira,
  resolveTransferFee,
  transferFeeBreakdown,
  transferFeeNaira,
  transferStampDutyNaira,
} from '@/lib/paystack-fees';

/**
 * What Paystack charges to send a payout, and therefore what the platform's
 * reconciliation has to account for. The bands are from Paystack's own pricing
 * page; the boundary values are the whole point of the tests.
 */
describe('transferFeeNaira', () => {
  it('is free for zero and for nonsense', () => {
    expect(transferFeeNaira(0)).toBe(0);
    expect(transferFeeNaira(-500)).toBe(0);
    expect(transferFeeNaira(Number.NaN)).toBe(0);
  });

  it('charges ₦10 up to and including ₦5,000', () => {
    expect(transferFeeNaira(100)).toBe(10);
    expect(transferFeeNaira(4999.99)).toBe(10);
    expect(transferFeeNaira(5000)).toBe(10);
  });

  it('charges ₦25 from ₦5,001 to ₦50,000', () => {
    expect(transferFeeNaira(5000.01)).toBe(25);
    expect(transferFeeNaira(20000)).toBe(25);
    expect(transferFeeNaira(50000)).toBe(25);
  });

  it('charges ₦50 above ₦50,000', () => {
    expect(transferFeeNaira(50000.01)).toBe(50);
    expect(transferFeeNaira(1_000_000)).toBe(50);
    expect(transferFeeNaira(999_999_999)).toBe(50);
  });

  it('accepts numeric strings, which is how amounts arrive from JSON', () => {
    expect(transferFeeNaira('20000' as unknown as number)).toBe(25);
  });
});

describe('transferStampDutyNaira', () => {
  it('does not apply below ₦10,000', () => {
    expect(transferStampDutyNaira(0)).toBe(0);
    expect(transferStampDutyNaira(9999.99)).toBe(0);
  });

  it('applies from exactly ₦10,000', () => {
    expect(transferStampDutyNaira(10000)).toBe(50);
    expect(transferStampDutyNaira(1_000_000)).toBe(50);
  });

  it('is a flat ₦50, not a percentage', () => {
    expect(transferStampDutyNaira(10000)).toBe(transferStampDutyNaira(10_000_000));
  });
});

describe('transferFeeBreakdown', () => {
  it('adds the fee and the stamp duty', () => {
    expect(transferFeeBreakdown(20000)).toEqual({
      amount: 20000,
      transferFee: 25,
      stampDuty: 50,
      total: 75,
      source: 'computed',
    });
  });

  it('has no stamp duty on a small transfer', () => {
    expect(transferFeeBreakdown(3000)).toMatchObject({ transferFee: 10, stampDuty: 0, total: 10 });
  });

  it('rounds the amount it reports to kobo', () => {
    expect(transferFeeBreakdown(10000.126).amount).toBe(10000.13);
    expect(transferFeeBreakdown(10000.124).amount).toBe(10000.12);
  });

  it('is all zeros for a zero transfer', () => {
    expect(transferFeeBreakdown(0)).toMatchObject({ transferFee: 0, stampDuty: 0, total: 0 });
  });
});

describe('providerTransferFeeNaira', () => {
  it('returns null when the payload carries no fee', () => {
    expect(providerTransferFeeNaira(null)).toBeNull();
    expect(providerTransferFeeNaira({})).toBeNull();
    expect(providerTransferFeeNaira({ status: 'success' })).toBeNull();
  });

  it('reads a kobo fee and converts it to naira', () => {
    expect(providerTransferFeeNaira({ fee_charged: 2500 })).toBe(25);
    expect(providerTransferFeeNaira({ fee: 1000 })).toBe(10);
    expect(providerTransferFeeNaira({ transfer_fee: 5000 })).toBe(50);
  });

  it('ignores a fee that is larger than the transfer itself', () => {
    expect(providerTransferFeeNaira({ fee: 900000, amount: 50000 })).toBeNull();
  });

  it('ignores negative and non-numeric fees', () => {
    expect(providerTransferFeeNaira({ fee: -100 })).toBeNull();
    expect(providerTransferFeeNaira({ fee: 'abc' })).toBeNull();
    expect(providerTransferFeeNaira({ fee: '' })).toBeNull();
  });
});

describe('resolveTransferFee', () => {
  it('falls back to the computed total and says so', () => {
    const result = resolveTransferFee(20000, { status: 'success' });
    expect(result.fee).toBe(75);
    expect(result.source).toBe('computed');
    expect(result.breakdown.transferFee).toBe(25);
  });

  it('prefers the provider figure when one is present', () => {
    const result = resolveTransferFee(20000, { fee_charged: 2500, amount: 2000000 });
    expect(result.fee).toBe(25);
    expect(result.source).toBe('provider');
  });

  it('records the declared source constant', () => {
    expect(PAYSTACK_TRANSFER_FEES.source).toBe('computed');
  });
});
