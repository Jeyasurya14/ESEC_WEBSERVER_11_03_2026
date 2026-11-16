import { heatmapSeries } from './heatmap-chart.utils';

import { describe, expect, it } from 'vitest';
import { DEFAULT_HEATMAP_COLORS } from '../report-settings.service';
import { heatmapChartOptions } from './heatmap-options';

const rows = [
  {
    c_date: '01-Jan-2027',
    c_hour: '09:00',
    p_qty_p: 90,
    p_qty_a: 40,
    qty_i: 10,
    qty_p: 9,
    qty_a: 4,
  },
  { c_date: '31-Dec-2026', c_hour: '8', p_qty_p: 0, p_qty_a: 0, qty_i: 10, qty_p: 0, qty_a: 0 },
];
function series(options: ReturnType<typeof heatmapChartOptions>) {
  const series = heatmapSeries(options);
  if (!series) throw new Error('Expected heatmap series');
  return series;
}

describe('Shared Highcharts usage heatmap', () => {
  it('reuses parsed response data for display filters and recognizes holiday aliases', () => {
    let dateReads = 0;
    const response = [
      {
        ...rows[0],
        get c_date() {
          dateReads++;
          return '01-Jan-2027';
        },
        c_holi: 'holiday',
      },
      rows[1],
    ];
    const first = heatmapChartOptions(response, DEFAULT_HEATMAP_COLORS);
    const reads = dateReads;
    const filtered = heatmapChartOptions(response, DEFAULT_HEATMAP_COLORS, {
      workingDaysOnly: true,
      showUsed: true,
      hiddenBands: ['from80To90'],
    });
    expect(dateReads).toBe(reads);
    expect(filtered.yAxis).toMatchObject({ categories: ['31-Dec-2026'] });
    expect(series(first).data).toHaveLength(2);
    expect(series(filtered).data).toHaveLength(1);
  });
  it('orders dates chronologically and plots hour aliases with the selected percentage and quantities', () => {
    const chart = heatmapChartOptions(rows, DEFAULT_HEATMAP_COLORS, { metric: 'average' });
    expect(chart.yAxis).toMatchObject({ categories: ['31-Dec-2026', '01-Jan-2027'] });
    expect(chart.xAxis).toMatchObject({
      categories: Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0')),
    });
    expect(series(chart).data![0]).toMatchObject({
      x: 9,
      y: 1,
      value: 40,
      custom: { issued: 10, used: 4 },
    });
    expect(rows[0].p_qty_p).toBe(90);
  });

  it('preserves date and hour coordinates when zero or range filters hide an entire date', () => {
    const chart = heatmapChartOptions(rows, DEFAULT_HEATMAP_COLORS, {
      showZero: false,
      maximum: 80,
    });
    expect(chart.yAxis).toMatchObject({ categories: ['31-Dec-2026', '01-Jan-2027'] });
    expect(series(chart).data).toEqual([
      expect.objectContaining({ x: 9, y: 1, value: null }),
      expect.objectContaining({ x: 8, y: 0, value: null }),
    ]);
  });

  it('skips invalid dates, hours and non-finite or missing percentages instead of inventing usage', () => {
    const invalid = [
      { ...rows[0], c_hour: '' },
      { ...rows[0], c_hour: '24' },
      { ...rows[0], c_hour: '8.5' },
      { ...rows[0], c_date: 'invalid' },
      { ...rows[0], p_qty_p: Infinity },
      { ...rows[0], p_qty_p: undefined },
    ];
    expect(series(heatmapChartOptions(invalid, DEFAULT_HEATMAP_COLORS)).data).toEqual([]);
  });

  it('keeps the percentage for colors when issued and used labels are enabled', () => {
    const chart = heatmapChartOptions(rows, DEFAULT_HEATMAP_COLORS, {
      showIssued: true,
      showUsed: true,
    });
    expect(series(chart).data![0]).toMatchObject({ value: 90, custom: { issued: 10, used: 9 } });
    expect(series(chart).dataLabels).toMatchObject({ enabled: true });
    expect(chart.chart).toMatchObject({
      backgroundColor: '#ffffff',
      plotBackgroundColor: '#ffffff',
    });
  });

  it('reserves chart space for compact cells and delegates headers and scrolling to the matrix container', () => {
    const plain = heatmapChartOptions(rows, DEFAULT_HEATMAP_COLORS);
    const quantities = heatmapChartOptions(rows, DEFAULT_HEATMAP_COLORS, {
      showUsed: true,
      showIssued: true,
    });
    expect(plain.chart?.height).toBe(50);
    expect(quantities.chart?.height).toBe(84);
    expect(plain.chart?.scrollablePlotArea).toBeUndefined();
    expect(plain.chart?.events).toBeUndefined();
    expect(plain.xAxis).toMatchObject({ visible: false, categories: expect.any(Array) });
    expect(plain.exporting?.chartOptions?.xAxis).toMatchObject({ visible: true, opposite: true });
    expect(series(plain).dataLabels).toMatchObject({ enabled: true });
    expect(plain.legend).toMatchObject({ enabled: false });
  });

  it('sorts dates both ways and masks hidden bands without changing data or axis positions', () => {
    const chart = heatmapChartOptions(rows, DEFAULT_HEATMAP_COLORS, {
      hiddenBands: ['from80To90'],
      dateDescending: true,
    });
    expect(chart.yAxis).toMatchObject({ categories: ['01-Jan-2027', '31-Dec-2026'] });
    expect(series(chart).data![0]).toMatchObject({ x: 9, y: 0, value: null, color: '#ffffff' });
    expect(rows[0].p_qty_p).toBe(90);
  });
});
