const HOLIDAY_VALUES = new Set(['y', 'yes', 'holiday']);
import type { ColorAxisOptions, Options, PointOptionsObject } from 'highcharts';
import { formatDate, parseDate } from '../dates';
import { toNumber } from '../grid/columns';
import { HeatmapColorScale } from '../report-settings.service';

export interface UsageHeatmapRow {
  holi_date?: unknown;
  holi?: unknown;
  li_holi?: unknown;
  c_holi?: unknown;
  c_date?: unknown;
  date?: unknown;
  c_hour?: unknown;
  p_qty_p?: unknown;
  p_qty_a?: unknown;
  qty_i?: unknown;
  qty_p?: unknown;
  qty_a?: unknown;
}

export interface UsageHeatmapOptions {
  metric?: 'peak' | 'average';
  minimum?: number;
  maximum?: number;
  showZero?: boolean;
  labels?: boolean;
  showIssued?: boolean;
  showUsed?: boolean;
  hiddenBands?: readonly (keyof HeatmapColorScale)[];
  dateDescending?: boolean;
  workingDaysOnly?: boolean;
}

export const HEATMAP_BANDS: readonly {
  key: keyof HeatmapColorScale;
  label: string;
  maximum: number;
}[] = [
  { key: 'from0To50', label: '0% - 50%', maximum: 50 },
  { key: 'from50To60', label: '50% - 60%', maximum: 60 },
  { key: 'from60To70', label: '60% - 70%', maximum: 70 },
  { key: 'from70To80', label: '70% - 80%', maximum: 80 },
  { key: 'from80To90', label: '80% - 90%', maximum: 90 },
  { key: 'from90To99', label: '90% - 99%', maximum: 100 },
  { key: 'at100', label: '100%', maximum: Infinity },
];

function usageBand(value: number): keyof HeatmapColorScale | undefined {
  if (value <= 0) return undefined;
  if (value >= 100) return 'at100';
  return HEATMAP_BANDS.find((band) => value <= band.maximum)?.key;
}

export function heatmapColorAxis(colors: HeatmapColorScale): ColorAxisOptions {
  return {
    dataClasses: [
      { to: 0, color: '#ffffff', name: '0%' },
      { from: 0.01, to: 50, color: colors.from0To50, name: '0% - 50%' },
      { from: 50.01, to: 60, color: colors.from50To60, name: '50% - 60%' },
      { from: 60.01, to: 70, color: colors.from60To70, name: '60% - 70%' },
      { from: 70.01, to: 80, color: colors.from70To80, name: '70% - 80%' },
      { from: 80.01, to: 90, color: colors.from80To90, name: '80% - 90%' },
      { from: 90.01, to: 99.99, color: colors.from90To99, name: '90% - 99%' },
      { from: 100, color: colors.at100, name: '100%' },
    ],
  };
}

interface HeatmapCell {
  date: string;
  hour: number;
  value: number;
  issued: number | null;
  used: number | null;
}
interface PreparedHeatmap {
  holidays: Set<string>;
  cells: HeatmapCell[];
  dates: string[];
}
const preparedRows = new WeakMap<
  readonly UsageHeatmapRow[],
  Partial<Record<'peak' | 'average', PreparedHeatmap>>
>();

/** Parse immutable report responses once; display controls reuse normalized dates and values. */
function prepareHeatmap(
  rows: readonly UsageHeatmapRow[],
  metric: 'peak' | 'average',
): PreparedHeatmap {
  const cached = preparedRows.get(rows) ?? {};
  if (cached[metric]) return cached[metric]!;
  const useAverage = metric === 'average';
  const holidays = new Set(
    rows
      .filter((row) =>
        [row.holi_date, row.holi, row.li_holi, row.c_holi].some((value) =>
          HOLIDAY_VALUES.has(String(value ?? '').toLowerCase()),
        ),
      )
      .map((row) => String(row.c_date ?? row.date ?? '')),
  );
  const dateTimestamps = new Map<string, number>();
  const cells = rows.flatMap((row) => {
    const date = String(row.c_date ?? row.date ?? '');
    if (!dateTimestamps.has(date)) dateTimestamps.set(date, parseDate(date)?.getTime() ?? NaN);
    const hourText = String(row.c_hour ?? '').trim();
    const hour = Number(hourText.split(':')[0]);
    const value = toNumber(useAverage ? row.p_qty_a : row.p_qty_p);
    if (
      !Number.isFinite(dateTimestamps.get(date)) ||
      !hourText ||
      !Number.isInteger(hour) ||
      hour < 0 ||
      hour > 23 ||
      value === null
    )
      return [];
    return [
      {
        date,
        hour,
        value,
        issued: toNumber(row.qty_i),
        used: toNumber(useAverage ? row.qty_a : row.qty_p),
      },
    ];
  });
  const dates = [...new Set(cells.map((cell) => cell.date))].sort(
    (firstDate, secondDate) => dateTimestamps.get(firstDate)! - dateTimestamps.get(secondDate)!,
  );
  const prepared = { holidays, cells, dates };
  cached[metric] = prepared;
  preparedRows.set(rows, cached);
  return prepared;
}

/** One builder for Organization details and scoped reports. No report data is mutated. */
export function heatmapChartOptions(
  rows: readonly UsageHeatmapRow[],
  colors: HeatmapColorScale,
  options: UsageHeatmapOptions = {},
): Options {
  const useAverage = options.metric === 'average';
  const rowHeight = options.showIssued || options.showUsed ? 40 : 23;
  const prepared = prepareHeatmap(rows, useAverage ? 'average' : 'peak');
  const { holidays } = prepared;
  const cells = options.workingDaysOnly
    ? prepared.cells.filter((cell) => !holidays.has(cell.date))
    : prepared.cells;
  const dates = options.workingDaysOnly
    ? prepared.dates.filter((date) => !holidays.has(date))
    : [...prepared.dates];
  if (options.dateDescending) dates.reverse();
  const dateIndex = new Map(dates.map((date, index) => [date, index]));
  const hours = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0'));
  const hiddenBands = new Set(options.hiddenBands);
  const heatmapPoints: PointOptionsObject[] = cells.map((cell) => {
    const band = usageBand(cell.value);
    const isHidden =
      cell.value < (options.minimum ?? 0) ||
      cell.value > (options.maximum ?? Infinity) ||
      (options.showZero === false && cell.value === 0) ||
      (!!band && hiddenBands.has(band));
    return {
      x: cell.hour,
      y: dateIndex.get(cell.date),
      value: isHidden ? null : cell.value,
      color: isHidden || !band ? '#ffffff' : colors[band],
      custom: { date: cell.date, hour: hours[cell.hour], issued: cell.issued, used: cell.used },
    };
  });
  return {
    chart: {
      type: 'heatmap',
      backgroundColor: '#ffffff',
      plotBackgroundColor: '#ffffff',
      animation: false,
      allowMutatingData: false,
      height: Math.max(27, dates.length * rowHeight + 4),
      margin: [0, 4, 4, 110],
    },
    title: { text: undefined },
    credits: { enabled: false },
    exporting: {
      chartOptions: {
        chart: { marginTop: 28, height: Math.max(55, dates.length * rowHeight + 32) },
        xAxis: { visible: true, opposite: true, labels: { y: -8, style: { color: '#1f2937' } } },
      },
    },

    xAxis: {
      categories: hours,
      visible: false,
      min: 0,
      max: 23,
      tickLength: 0,
      tickInterval: 1,
      lineWidth: 0,
      title: { text: undefined },
      labels: { step: 1, y: -8, style: { color: '#ffffff', fontSize: '11px', fontWeight: '600' } },
    },
    yAxis: {
      categories: dates,
      min: 0,
      max: Math.max(0, dates.length - 1),
      reversed: true,
      title: { text: undefined },
      tickLength: 0,
      gridLineWidth: 1,
      gridLineColor: '#d4d9df',
      tickInterval: 1,
      labels: {
        step: 1,
        useHTML: true,
        align: 'left',
        x: -106,
        y: 3,
        formatter() {
          const date = dates[Number(this.pos)] ?? '';
          const background = holidays.has(date) ? '#faa0a0' : '#f5f7f9';
          return (
            '<span style="display:inline-flex;align-items:center;width:102px;height:' +
            rowHeight +
            'px;padding-left:8px;box-sizing:border-box;background:' +
            background +
            ';font-size:11px;color:#1f2937">' +
            formatDate(date) +
            '</span>'
          );
        },
      },
    },
    colorAxis: heatmapColorAxis(colors),
    legend: { enabled: false },
    plotOptions: { series: { animation: false } },
    tooltip: {
      headerFormat: '',
      pointFormat: '{point.custom.date}, {point.custom.hour}:00: <b>{point.value:.1f}%</b>',
    },
    series: [
      {
        type: 'heatmap',
        id: 'usage-heatmap',
        name: useAverage ? 'Average utilization' : 'Peak utilization',
        data: heatmapPoints,
        borderWidth: 1,
        borderColor: '#d4d9df',
        nullColor: '#ffffff',
        dataLabels: {
          enabled: true,
          allowOverlap: true,
          padding: 1,
          style: { color: '#111827', fontSize: '11px', fontWeight: '400', textOutline: 'none' },
          formatter() {
            if (this.value === null || this.value === undefined) return '';
            if (this.options.custom?.['issued'] === 0) return '0';
            const quantities = [
              options.showUsed ? this.options.custom?.['used'] : null,
              options.showIssued ? this.options.custom?.['issued'] : null,
            ]
              .filter((value) => value !== null && value !== undefined)
              .join(' / ');
            const percentage = Number(this.value.toFixed(2)) + '%';
            return quantities ? quantities + '<br/>' + percentage : percentage;
          },
        },
      },
    ],
  };
}
