import { describe, expect, it } from 'vitest';
import { visibleHeatmapRows } from './heatmap-chart.utils';

describe('Buffered heatmap scrolling', () => {
  it('keeps every visible row mounted while reducing updates during continuous scrolling', () => {
    let window = visibleHeatmapRows(0, 640, 360, 23);
    let updates = 0;
    for (let top = 0; top <= 2000; top++) {
      const next = visibleHeatmapRows(top, 640, 360, 23, window);
      if (next !== window) updates++;
      const first = Math.floor(Math.max(0, top - 28) / 23);
      const last = Math.ceil((Math.max(0, top - 28) + 640) / 23);
      expect(next.start).toBeLessThanOrEqual(first);
      expect(next.end).toBeGreaterThanOrEqual(last);
      expect(next.end - next.start).toBeLessThanOrEqual(46);
      window = next;
    }
    expect(updates).toBeLessThan(16);
    for (let top = 2000; top >= 0; top -= 17) {
      window = visibleHeatmapRows(top, 640, 360, 23, window);
      expect(window.start).toBeLessThanOrEqual(Math.floor(Math.max(0, top - 28) / 23));
      expect(window.end).toBeGreaterThanOrEqual(Math.ceil((Math.max(0, top - 28) + 640) / 23));
    }
  });

  it('clamps jumps to the last row and resets correctly for smaller data or a resized viewport', () => {
    const bottom = visibleHeatmapRows(100000, 640, 360, 23);
    expect(bottom.end).toBe(360);
    expect(bottom.start).toBeGreaterThan(300);
    expect(visibleHeatmapRows(100000, 640, 3, 23, bottom)).toEqual({ start: 0, end: 3 });
    expect(visibleHeatmapRows(0, 300, 360, 23).end).toBeLessThan(
      visibleHeatmapRows(0, 900, 360, 23).end,
    );
    expect(visibleHeatmapRows(0, 640, 0, 23)).toEqual({ start: 0, end: 0 });
  });
});
