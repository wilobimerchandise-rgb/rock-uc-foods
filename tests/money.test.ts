import { describe, it, expect } from 'vitest';
import { formatNaira, parseNairaToKobo, applyPercentRoundHalfUp } from '../src/lib/money';

describe('Money Utilities (Golden Fixtures)', () => {
  it('formatNaira formats correctly', () => {
    expect(formatNaira(123456789n)).toBe('₦1,234,567.89');
    expect(formatNaira(150000n)).toBe('₦1,500.00');
  });

  it('parseNairaToKobo parses valid inputs', () => {
    expect(parseNairaToKobo('1,500.5')).toEqual({ ok: true, kobo: 150050n });
    expect(parseNairaToKobo('3500')).toEqual({ ok: true, kobo: 350000n });
    expect(parseNairaToKobo('12.50')).toEqual({ ok: true, kobo: 1250n });
  });

  it('parseNairaToKobo rejects invalid inputs', () => {
    expect(parseNairaToKobo('1.999')).toEqual({ ok: false, error: expect.stringContaining('Invalid currency format') });
    expect(parseNairaToKobo('-5')).toEqual({ ok: false, error: 'Negative amounts are not allowed' });
    expect(parseNairaToKobo('abc')).toEqual({ ok: false, error: expect.stringContaining('Invalid currency format') });
    expect(parseNairaToKobo('')).toEqual({ ok: false, error: 'Invalid input: must be a non-empty string' });
    expect(parseNairaToKobo('3.5k')).toEqual({ ok: false, error: expect.stringContaining('Invalid currency format') });
  });

  it('applyPercentRoundHalfUp rounds correctly', () => {
    expect(applyPercentRoundHalfUp(333n, 750)).toBe(25n);
    expect(applyPercentRoundHalfUp(970000n, 1000)).toBe(97000n);
  });
});
