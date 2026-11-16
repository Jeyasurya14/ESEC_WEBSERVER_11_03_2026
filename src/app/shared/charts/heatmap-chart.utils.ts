import type { Options, PointOptionsObject, SeriesHeatmapOptions, YAxisOptions } from 'highcharts';

type HeatmapPoint = NonNullable<SeriesHeatmapOptions['data']>[number];
export interface VisibleRows {
  start: number;
  end: number;
}

export function heatmapSeries(options: Options): SeriesHeatmapOptions | undefined {
  const series = options.series?.[0];
  return series && 'type' in series && series.type === 'heatmap' ? series : undefined;
}

function isPoint(point: HeatmapPoint): point is PointOptionsObject {
  return typeof point === 'object' && point !== null && !Array.isArray(point);
}

export function groupHeatmapPoints(options: Options): ReadonlyMap<number, PointOptionsObject[]> {
  const rows = new Map<number, PointOptionsObject[]>();
  for (const point of heatmapSeries(options)?.data ?? []) {
    if (!isPoint(point)) continue;
    const rowIndex = point.y ?? 0;
    const values = rows.get(rowIndex) ?? [];
    values.push(point);
    rows.set(rowIndex, values);
  }
  return rows;
}

export function visibleHeatmapRows(
  top: number,
  height: number,
  count: number,
  rowHeight: number,
  previous?: VisibleRows,
): VisibleRows {
  const bodyTop = Math.max(0, top - 28);
  const first = Math.min(Math.max(0, count - 1), Math.floor(bodyTop / rowHeight));
  const last = Math.min(count, Math.ceil((bodyTop + height) / rowHeight));
  // Keep the SVG stable until the viewport consumes most of its eight-row buffer.
  if (
    previous &&
    previous.end <= count &&
    (previous.start === 0 || first >= previous.start + 2) &&
    (previous.end === count || last <= previous.end - 2)
  )
    return previous;
  return {
    start: Math.max(0, first - 8),
    end: Math.min(count, last + 8),
  };
}

function heatmapExportRows(
  dates: readonly string[],
  hours: readonly string[],
  points: ReadonlyMap<number, PointOptionsObject[]>,
): string[][] {
  return [
    ['Date', ...hours],
    ...dates.map((date, index) => {
      const values = new Array<string>(24).fill('');
      for (const point of points.get(index) ?? []) {
        if (
          typeof point.x === 'number' &&
          point.x >= 0 &&
          point.x < 24 &&
          point.value !== null &&
          point.value !== undefined
        )
          values[point.x] = String(point.value);
      }
      return [date, ...values];
    }),
  ];
}

export function viewportHeatmapOptions(
  options: Options,
  axis: YAxisOptions,
  range: VisibleRows,
  rowHeight: number,
  hours: readonly string[],
  points: ReadonlyMap<number, PointOptionsObject[]>,
): Options {
  const { start, end } = range;
  const visiblePoints: PointOptionsObject[] = [];
  for (let index = start; index < end; index++) visiblePoints.push(...(points.get(index) ?? []));
  const original = heatmapSeries(options);
  return {
    ...options,
    chart: {
      ...options.chart,
      animation: false,
      height: Math.max(27, (end - start) * rowHeight + 4),
      events: {
        ...options.chart?.events,
        exportData: (event) => {
          const rows = heatmapExportRows(axis.categories ?? [], hours, points);
          event.dataRows.length = 0;
          event.dataRows.push(...rows);
        },
      },
    },
    yAxis: { ...axis, min: start, max: Math.max(start, end - 1) },
    series: original ? [{ ...original, data: visiblePoints }] : [],
    // The viewport bounds rendering; exports must retain every date.
    exporting: {
      ...options.exporting,
      chartOptions: {
        ...options.exporting?.chartOptions,
        chart: { ...options.chart, ...options.exporting?.chartOptions?.chart },
        yAxis: { ...axis, min: 0, max: Math.max(0, (axis.categories?.length ?? 0) - 1) },
        series: options.series,
      },
    },
  };
}
