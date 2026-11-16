import { describe, expect, it } from 'vitest';
import { countAtOrAbovePercentile, percentile } from './percentile';

describe('percentile', () => {
  it('returns 0 for an empty series', () => {
    expect(percentile([], 95)).toBe(0);
  });

  it('returns the only value for a single-value series, at any percentile', () => {
    expect(percentile([42], 95)).toBe(42);
    expect(percentile([42], 0)).toBe(42);
  });

  it('returns the maximum at the 100th percentile', () => {
    expect(percentile([10, 30, 20], 100)).toBe(30);
  });

  it('returns the minimum at the 0th percentile', () => {
    expect(percentile([10, 30, 20], 0)).toBe(10);
  });

  it('interpolates between the two closest ranks', () => {
    // Sorted: [10, 20, 30, 40, 50]. 50th percentile sits exactly on the middle value.
    expect(percentile([50, 10, 30, 40, 20], 50)).toBe(30);
    // 25th percentile: rank = 0.25 * 4 = 1 -> exactly the 2nd value (20), no interpolation needed.
    expect(percentile([50, 10, 30, 40, 20], 25)).toBe(20);
  });

  it("doesn't mutate the input array", () => {
    const values = [30, 10, 20];
    percentile(values, 50);
    expect(values).toEqual([30, 10, 20]);
  });
});

describe('countAtOrAbovePercentile', () => {
  it('counts every value at or above the percentile value, inclusive', () => {
    // 100th percentile is the max (30): only the 30 itself is at/above it.
    expect(countAtOrAbovePercentile([10, 20, 30], 100)).toBe(1);
  });

  it('counts all values when the percentile value is the minimum', () => {
    expect(countAtOrAbovePercentile([10, 20, 30], 0)).toBe(3);
  });
});
