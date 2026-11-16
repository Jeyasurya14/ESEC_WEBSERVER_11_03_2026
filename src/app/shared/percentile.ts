/**
 * The standard linear-interpolation percentile (the same method as Excel's `PERCENTILE.INC` and
 * numpy's default): the value below which `percentile`% of `values` fall, interpolated between
 * the two closest ranks when the percentile doesn't land exactly on one.
 */
export function percentile(values: readonly number[], percentileRank: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((firstValue, secondValue) => firstValue - secondValue);
  if (percentileRank >= 100) {
    return sorted[sorted.length - 1];
  }

  const rank = (Math.max(0, percentileRank) * (sorted.length - 1)) / 100;
  const lowerIndex = Math.trunc(rank);
  const fraction = rank - lowerIndex;
  const lower = sorted[lowerIndex];
  const upper = sorted[Math.min(lowerIndex + 1, sorted.length - 1)];
  return lower + fraction * (upper - lower);
}

/** How many of `values` are at or above the given percentile's value. */
export function countAtOrAbovePercentile(
  values: readonly number[],
  percentileRank: number,
): number {
  const value = percentile(values, percentileRank);
  return values.filter((item) => item >= value).length;
}
