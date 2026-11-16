import { describe, expect, it } from 'vitest';
import { BandLimits } from '../filters/usage-band-filter';
import { gaugeChartOptions } from './gauge-options';

const LIMITS: BandLimits = {
  lowBelow: 60,
  highFrom: 80,
  bandColors: { low: '#111111', medium: '#222222', high: '#333333' },
};

function series(options: ReturnType<typeof gaugeChartOptions>) {
  const [first] = options.series ?? [];
  if (!first || !('type' in first) || first.type !== 'gauge')
    throw new Error('Expected gauge series');
  return first;
}

describe('gaugeChartOptions', () => {
  it('plots the given percentage as the gauge value', () => {
    expect(series(gaugeChartOptions(42, LIMITS)).data).toEqual([42]);
  });

  it('clamps out-of-range percentages into the 0-100 dial', () => {
    expect(series(gaugeChartOptions(-5, LIMITS)).data).toEqual([0]);
    expect(series(gaugeChartOptions(150, LIMITS)).data).toEqual([100]);
  });

  it('uses a safe zero value for missing or non-finite usage', () => {
    for (const value of [NaN, Infinity, -Infinity])
      expect(series(gaugeChartOptions(value, LIMITS)).data).toEqual([0]);
  });

  it('colours the dial for the band the percentage falls in', () => {
    expect(series(gaugeChartOptions(50, LIMITS)).dial?.backgroundColor).toBe(
      LIMITS.bandColors?.low,
    );
    expect(series(gaugeChartOptions(90, LIMITS)).dial?.backgroundColor).toBe(
      LIMITS.bandColors?.high,
    );
  });

  it('draws the three band colours as plot bands split at the given limits', () => {
    const yAxis = gaugeChartOptions(50, LIMITS).yAxis;
    const plotBands = (Array.isArray(yAxis) ? yAxis[0] : yAxis)?.plotBands ?? [];

    expect(plotBands).toEqual([
      { from: 0, to: 60, color: LIMITS.bandColors?.low, thickness: 10 },
      { from: 60, to: 80, color: LIMITS.bandColors?.medium, thickness: 10 },
      { from: 80, to: 100, color: LIMITS.bandColors?.high, thickness: 10 },
    ]);
  });
});
