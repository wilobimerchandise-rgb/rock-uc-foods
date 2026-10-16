import { describe, it, expect } from 'vitest';
import { formatNaira, parseNairaToKobo, applyPercentRoundHalfUp } from '../src/lib/money';

describe('Money Utilities (Golden Fixtures)', () => {
  it('formatNaira formats correctly', () => {
    expect(formatNaira(123456789n)).toBe('1,234,567.89');
    expect(formatNaira(150000n)).toBe('₦1,500.00');
  });

  it('parseNairaToKobo parses valid inputs', () => {
    expect(parseNairaToKobo('1,500.5')).toBe(150050n);
    expect(parseNairaToKobo('3500')).toBe(350000n);
    expect(parseNairaToKobo('12.50')).toBe(1250n);
  });

  it('parseNairaToKobo rejects invalid inputs', () => {
    expect(() => parseNairaToKobo('1.999')).toThrow();
    expect(() => parseNairaToKobo('-5')).toThrow();
    expect(() => parseNairaToKobo('abc')).toThrow();
    expect(() => parseNairaToKobo('')).toThrow();
    expect(() => parseNairaToKobo('3.5k')).toThrow();
  });

  it('applyPercentRoundHalfUp rounds correctly', () => {
    // 7.5% (750 bps) of 333 kobo = 24.975 -> rounds to 25
    expect(applyPercentRoundHalfUp(333n, 750)).toBe(25n);
    // 10% (1000 bps) of 970000 = 97000
    expect(applyPercentRoundHalfUp(970000n, 1000)).toBe(97000n);
  });
});
