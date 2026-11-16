import type { Options, SeriesLineOptions } from 'highcharts';
import { toNumber } from '../../../shared/grid/columns';
import { HeatmapColorScale, ReportSettings } from '../../../shared/report-settings.service';
import { LicenseRecord } from '../report-helpers';
import { percentile } from '../../../shared/percentile';
import { summaryChartOptions } from '../summary/summary-chart-options';
import { SummarySeriesId } from '../summary/license-summary.data';
import { heatmapChartOptions } from '../../../shared/charts/heatmap-options';
import { durationPoints, polynomialCurve } from './usage-analysis';
import { DetailParameters, DetailView, holidayRow } from './detail-queries';

export interface DetailChartOptions {
  percentage: boolean;
  visible: readonly SummarySeriesId[];
  labels: boolean;
  overlap: boolean;
  percentile: number;
  linear: boolean;
  polynomial: number;
  capacity: number;
  heatmapMetric: 'peak' | 'average';
  minimum: number;
  maximum: number;
  showZero: boolean;
  showIssued: boolean;
  showUsed: boolean;
  hiddenBands?: readonly (keyof HeatmapColorScale)[];
  dateDescending?: boolean;
}
export function detailChart(
  view: DetailView,
  records: LicenseRecord[],
  reportOptions: DetailParameters,
  options: DetailChartOptions,
  settings: ReportSettings,
): Options {
  const rows =
    reportOptions.workingDays && view !== 'heatmap'
      ? records.filter((row) => !holidayRow(row))
      : records;
  let chart: Options;
  if (view === 'utilization') {
    chart = summaryChartOptions(
      rows,
      reportOptions.granularity === 'date' || reportOptions.granularity === 'scatter'
        ? 'day'
        : reportOptions.granularity === 'week'
          ? 'week'
          : 'month',
      {
        mode: options.percentage ? 'percentage' : 'value',
        visible: options.visible,
        labels: options.labels,
        overlap: options.overlap,
        workingDaysOnly: false,
      },
    );
    if (reportOptions.granularity === 'scatter')
      chart.series = [
        {
          type: 'scatter',
          name: 'Utilization',
          data: rows.map((row, index) => [
            toNumber(row['qty_i']) ?? index,
            toNumber(row['qty_dp'] ?? row['used']),
          ]),
        },
      ];
  } else if (view === 'heatmap') {
    chart = heatmapChartOptions(rows, settings.heatmapColors, {
      metric: options.heatmapMetric,
      minimum: options.minimum,
      maximum: options.maximum,
      showZero: options.showZero,
      labels: options.labels,
      showIssued: options.showIssued,
      showUsed: options.showUsed,
      hiddenBands: options.hiddenBands,
      dateDescending: options.dateDescending,
      workingDaysOnly: reportOptions.workingDays,
    });
  } else if (view === 'history' || view === 'qos') {
    const field = view === 'history' ? 'qty_dp' : 'used';
    const points = durationPoints(rows, field, view === 'qos' && options.linear);
    const unique = [
      ...new Set(
        rows
          .map((row) => toNumber(row[field]))
          .filter((value): value is number => value !== null && (view !== 'qos' || value > 0)),
      ),
    ];
    const marker = percentile(unique, options.percentile);
    const series: SeriesLineOptions[] = [
      {
        type: 'line',
        name: options.percentage ? 'Percentage' : 'Count',
        data: points.map((point) => [
          point.quantity,
          options.percentage ? point.percentage : point.count,
        ]),
      },
    ];
    if (view === 'qos' && options.polynomial)
      series.push({
        type: 'line',
        name: `Order ${options.polynomial} fit (%)`,
        yAxis: 1,
        data: polynomialCurve(points, options.polynomial),
        dashStyle: 'ShortDash',
      });
    chart = {
      chart: { zooming: { type: 'x' } },
      xAxis: {
        title: { text: 'Licenses used' },
        plotLines: [
          {
            value: marker,
            color: '#d97706',
            width: 2,
            label: { text: `${options.percentile}th percentile: ${marker.toFixed(1)}` },
          },
          ...(options.capacity > 0
            ? [
                {
                  value: options.capacity,
                  color: '#dc2626',
                  width: 2,
                  label: { text: `Capacity: ${options.capacity}` },
                },
              ]
            : []),
        ],
      },
      yAxis: [
        {
          min: 0,
          title: {
            text: options.percentage
              ? 'Percentage'
              : reportOptions.category === 'date'
                ? 'Days'
                : 'Data points',
          },
        },
        { min: 0, opposite: true, title: { text: 'Fit (%)' } },
      ],
      series,
    };
  } else {
    const metrics =
      view === 'checkoutCount'
        ? ['qty_i', 'count']
        : view === 'hours'
          ? [
              'license_hours',
              'used_hours',
              'work_hours',
              'license_hours_used',
              'license_hours_work',
            ]
          : options.percentage
            ? ['p_dp', 'p_wp', 'p_used_hours']
            : ['license_hours', 'used_hours'];
    const availableMetrics = new Set<string>();
    for (const row of rows)
      for (const [key, value] of Object.entries(row))
        if (value !== undefined) availableMetrics.add(key);
    chart = {
      xAxis: {
        categories: rows.map((row) =>
          String(row['date'] ?? row['c_date'] ?? row['month'] ?? row['c_month'] ?? ''),
        ),
      },
      yAxis:
        view === 'checkoutCount'
          ? [{ title: { text: 'Issued' } }, { opposite: true, title: { text: 'Checkout Count' } }]
          : { min: 0, title: { text: options.percentage ? 'Percentage' : 'Hours' } },
      series: metrics
        .filter((metric) => availableMetrics.has(metric))
        .map((metric) => ({
          type: metric === 'count' ? 'column' : 'line',
          name: metric.replaceAll('_', ' '),
          yAxis: metric === 'count' ? 1 : 0,
          data: rows.map((row) => toNumber(row[metric])),
        })),
    };
  }
  return {
    ...chart,
    title: { text: undefined },
    credits: { enabled: false },
    chart: {
      ...chart.chart,
      backgroundColor: '#ffffff',
      plotBackgroundColor: '#ffffff',
      animation: false,
    },
    tooltip: { ...chart.tooltip, shared: view !== 'heatmap' },
    exporting: {
      ...chart.exporting,
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
            'downloadCSV',
            'downloadXLS',
          ],
        },
      },
    },
    plotOptions: {
      ...chart.plotOptions,
      series: {
        ...chart.plotOptions?.series,
        dataLabels: { enabled: options.labels, allowOverlap: options.overlap },
      },
    },
  };
}
