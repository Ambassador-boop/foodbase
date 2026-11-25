import { describe, expect, it } from 'vitest';
import { formatNaira } from '@/lib/finance';

/**
 * formatNaira is display only, but it is display of money: the only rule that
 * matters is that it never shows a wrong number, and that kobo appear only when
 * there are kobo.
 */
describe('formatNaira', () => {
  it('renders zero without decimals', () => {
    expect(formatNaira(0)).toContain('0');
    expect(formatNaira(0)).not.toContain('.00');
  });

  it('treats null and undefined as zero', () => {
    expect(formatNaira(null)).toBe(formatNaira(0));
    expect(formatNaira(undefined)).toBe(formatNaira(0));
  });

  it('shows whole naira without decimals', () => {
    const text = formatNaira(1500);
    expect(text).toContain('1,500');
    expect(text).not.toContain('.00');
  });

  it('shows kobo when the amount has them', () => {
    expect(formatNaira(1500.5)).toContain('1,500.50');
  });

  it('keeps two decimals for small kobo amounts', () => {
    expect(formatNaira(0.25)).toContain('0.25');
  });

  it('groups thousands', () => {
    expect(formatNaira(1234567)).toContain('1,234,567');
  });

  it('handles very large amounts without losing the number', () => {
    expect(formatNaira(1_000_000_000)).toContain('1,000,000,000');
  });

  it('never renders NaN or Infinity', () => {
    expect(formatNaira(Number.NaN)).toBe(formatNaira(0));
    expect(formatNaira(Number.POSITIVE_INFINITY)).toBe(formatNaira(0));
  });

  it('formats negative amounts, which appear in reconciliation views', () => {
    expect(formatNaira(-250)).toContain('250');
  });
});
