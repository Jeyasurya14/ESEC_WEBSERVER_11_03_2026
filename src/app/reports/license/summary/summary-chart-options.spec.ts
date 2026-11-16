import { ChartFixture } from '../../../../testing/chart-fixture';
import { literal } from '../../../core/utils/data';
import { AxisLabelsFormatterContextObject, Options } from 'highcharts';
import { describe, expect, it } from 'vitest';
import {
  summaryChartOptions,
  summaryChartRows,
  SummaryChartSettings,
} from './summary-chart-options';

const settings: SummaryChartSettings = {
  mode: 'value',
  visible: ['DP', 'WP', 'ISSUED'],
  workingDaysOnly: false,
  labels: true,
  overlap: false,
};
const rows = [
  {
    date: '01-Nov-2026',
    holi: 'y',
    qty_i: '10',
    qty_dp: '8',
    qty_da: 4,
    qty_dpm: 6,
    qty_wp: 7,
    p_dp: 80,
    p_dpm: 60,
  },
  { date: '02-Nov-2026', holi: 'n', qty_i: 10, qty_dp: 9, p_dp: 90 },
];
function values(series: NonNullable<Options['series']>[number] | undefined) {
  return series && 'data' in series ? series.data : undefined;
}

describe('Company Summary chart options', () => {
  it('builds daily issued/DP/DA/WP/WA lines, with the company default selection and colors', () => {
    const chart = summaryChartOptions(rows, 'day', settings);
    expect(chart.series?.map((series) => series.id)).toEqual(['DP', 'DA', 'WP', 'WA', 'ISSUED']);
    expect(chart.series?.filter((series) => series.visible).map((series) => series.id)).toEqual([
      'DP',
      'WP',
      'ISSUED',
    ]);
    expect(values(chart.series?.find((series) => series.id === 'DP'))).toEqual([8, 9]);
    expect(chart.series?.find((series) => series.id === 'DP')).toMatchObject({ color: '#1414E1' });
    expect(chart.series?.every((series) => 'type' in series && series.type === 'line')).toBe(true);
  });

  it('uses the returned percentages, omits Issued and retains mean variants in weekly views', () => {
    const chart = summaryChartOptions(rows, 'week', {
      ...settings,
      mode: 'percentage',
      visible: ['DPM'],
    });
    expect(chart.series).toHaveLength(8);
    expect(chart.series?.some((series) => series.id === 'ISSUED')).toBe(false);
    expect(values(chart.series?.find((series) => series.id === 'DPM'))).toEqual([60, null]);
    expect(chart.series?.find((series) => series.id === 'DPM')?.visible).toBe(true);
    expect(chart.yAxis).toMatchObject({ softMax: 100, title: { text: 'Utilization (%)' } });
  });

  it.each(literal(['month', 'year']))('uses %s columns with an issued line', (period) => {
    const chart = summaryChartOptions(rows, period, settings);
    expect(chart.series).toHaveLength(9);
    expect(chart.series?.find((series) => series.id === 'ISSUED')).toMatchObject({ type: 'line' });
    expect(chart.series?.find((series) => series.id === 'WP')).toMatchObject({ type: 'column' });
  });

  it('filters working days only for the daily chart without modifying the original rows', () => {
    expect(summaryChartRows(rows, 'day', true)).toEqual([rows[1]]);
    expect(summaryChartRows(rows, 'week', true)).toBe(rows);
    expect(
      summaryChartOptions(rows, 'day', { ...settings, workingDaysOnly: true }).xAxis,
    ).toMatchObject({ categories: ['02-Nov-2026'] });
    expect(rows).toHaveLength(2);
  });

  it('keeps invalid numbers as gaps and includes local export and label controls', () => {
    const chart = summaryChartOptions([{ date: 'day', qty_dp: Infinity }], 'day', {
      ...settings,
      labels: false,
      overlap: true,
    });
    expect(values(chart.series?.find((series) => series.id === 'DP'))).toEqual([null]);
    expect(chart.exporting).toMatchObject({
      enabled: true,
      local: true,
      fallbackToExportServer: false,
    });
    expect(chart.plotOptions?.series?.dataLabels).toMatchObject({
      enabled: false,
      allowOverlap: true,
    });
  });

  it('highlights holiday labels while escaping category text', () => {
    const chart = summaryChartOptions(
      [{ date: '<script>bad</script>', holi: 'y' }],
      'day',
      settings,
    );
    const axis = chart.xAxis;
    if (!axis || Array.isArray(axis)) throw new Error('Expected one category axis');
    const formatter = axis.labels!.formatter!;
    using rendered = new ChartFixture(chart);
    const realAxis = rendered.chart.xAxis[0];
    const context = {
      value: '<script>bad</script>',
      pos: 0,
      axis: realAxis,
      chart: rendered.chart,
      isFirst: true,
      isLast: true,
      tick: realAxis.ticks[0],
    } satisfies AxisLabelsFormatterContextObject;
    const result = formatter.call(context, context);
    expect(result).toContain('color:#dc2626');
    expect(result).toContain('&lt;script&gt;');
    expect(result).not.toContain('<script>');
  });
});
