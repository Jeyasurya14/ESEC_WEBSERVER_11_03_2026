import type { Options } from 'highcharts';
import { toNumber } from '../../../shared/grid/columns';
import {
  SUMMARY_SERIES,
  SummaryMode,
  SummaryPeriod,
  SummaryRecord,
  SummarySeriesId,
} from './license-summary.data';

export interface SummaryChartSettings {
  mode: SummaryMode;
  visible: readonly SummarySeriesId[];
  workingDaysOnly: boolean;
  labels: boolean;
  overlap: boolean;
}

function escapeLabel(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** The rows to chart: on the daily chart, only working days when that option is on. */
export function summaryChartRows(
  records: readonly SummaryRecord[],
  period: SummaryPeriod,
  settings: Pick<SummaryChartSettings, 'workingDaysOnly'>,
): readonly SummaryRecord[] {
  if (period !== 'day' || !settings.workingDaysOnly) return records;
  return records.filter((row) => String(row['holi']).trim().toLowerCase() === 'n');
}

/** The record field a series plots: issued quantity, or the series' quantity or percentage. */
function seriesField(seriesId: SummarySeriesId, percentage: boolean): string {
  if (seriesId === 'ISSUED') return 'qty_i';
  const prefix = percentage ? 'p' : 'qty';
  return `${prefix}_${seriesId.toLowerCase()}`;
}

export function summaryChartOptions(
  records: readonly SummaryRecord[],
  period: SummaryPeriod,
  settings: SummaryChartSettings,
): Options {
  const rows = summaryChartRows(records, period, settings);
  const holidays = new Set(
    rows.flatMap((row, index) => (String(row['holi']).toLowerCase() === 'y' ? [index] : [])),
  );
  const visibleSeries = new Set(settings.visible);
  const percentage = settings.mode === 'percentage';
  return {
    chart: {
      backgroundColor: '#ffffff',
      plotBackgroundColor: '#ffffff',
      animation: false,
      zooming: { type: 'x' },
      panning: { enabled: true, type: 'x' },
      panKey: 'shift',
    },
    title: { text: undefined },
    credits: { enabled: false },
    legend: { enabled: false },
    accessibility: { enabled: true, description: `${period} license utilization` },
    xAxis: {
      categories: rows.map((row) => String(row['date'] ?? '')),
      labels: {
        formatter() {
          const label = escapeLabel(String(this.value));
          return holidays.has(this.pos) ? `<span style="color:#dc2626">${label}</span>` : label;
        },
      },
    },
    yAxis: {
      min: 0,
      softMax: percentage ? 100 : undefined,
      title: { text: percentage ? 'Utilization (%)' : 'Licenses' },
      labels: { format: percentage ? '{value}%' : '{value}' },
    },
    tooltip: { shared: true, valueSuffix: percentage ? '%' : '' },
    exporting: {
      enabled: true,
      local: true,
      fallbackToExportServer: false,
      buttons: {
        contextButton: {
          menuItems: [
            'viewFullscreen',
            'printChart',
            'separator',
            'downloadPNG',
            'downloadJPEG',
            'downloadSVG',
            'separator',
            'downloadCSV',
            'downloadXLS',
          ],
        },
      },
    },
    plotOptions: {
      series: {
        animation: false,
        marker: { enabled: true, radius: 2 },
        dataLabels: {
          enabled: settings.labels,
          allowOverlap: settings.overlap,
          style: { textOutline: 'none', fontSize: '10px' },
          formatter() {
            return this.y !== this.series.data[this.index - 1]?.y ? this.y : undefined;
          },
        },
      },
    },
    series: SUMMARY_SERIES.filter(
      (series) => !(period === 'day' && series.mean) && !(percentage && series.id === 'ISSUED'),
    ).map((series) => ({
      id: series.id,
      name: series.label,
      color: series.color,
      type: period === 'day' || period === 'week' || series.id === 'ISSUED' ? 'line' : 'column',
      visible: visibleSeries.has(series.id),
      data: rows.map((row) => toNumber(row[seriesField(series.id, percentage)])),
    })),
  };
}
