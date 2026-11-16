import type { Options } from 'highcharts';
import { BandLimits, bandColor, bandOf } from '../filters/usage-band-filter';

const PANE_START_ANGLE = -120;
const PANE_END_ANGLE = 120;
const BAND_THICKNESS = 10;

/**
 * Highcharts' own "gauge" chart (https://www.highcharts.com/demo/highcharts/gauge-speedometer):
 * a dial over the report's low/medium/high band limits, needled to the given usage percentage.
 * The numeric readout is drawn in HTML over the chart (see `gauge.ts`) rather than as a Highcharts
 * data label, so it keeps lining up with the dial regardless of theme or container size.
 */
export function gaugeChartOptions(percent: number, limits: BandLimits): Options {
  const clampedPercent = Math.min(Math.max(Number.isFinite(percent) ? percent : 0, 0), 100);
  const needleColor = bandColor(bandOf(clampedPercent, limits), limits);

  return {
    chart: {
      type: 'gauge',
      height: 168,
      margin: 0,
      backgroundColor: '#ffffff',
      plotBackgroundColor: '#ffffff',
      spacing: [0, 0, 0, 0],
      animation: false,
    },
    title: { text: undefined },
    credits: { enabled: false },
    exporting: { enabled: false },
    accessibility: { enabled: false },
    tooltip: { enabled: false },
    pane: {
      startAngle: PANE_START_ANGLE,
      endAngle: PANE_END_ANGLE,
      background: { backgroundColor: '#ffffff', borderWidth: 0 },
      center: ['50%', '63%'],
      size: '108%',
    },
    yAxis: {
      min: 0,
      max: 100,
      lineWidth: 0,
      gridLineWidth: 0,
      minorGridLineWidth: 0,
      tickInterval: 20,
      tickColor: '#cfd8e3',
      tickLength: 4,
      labels: { distance: -18, style: { fontSize: '8px', color: '#8793a5' } },
      plotBands: [
        {
          from: 0,
          to: limits.lowBelow,
          color: bandColor('low', limits),
          thickness: BAND_THICKNESS,
        },
        {
          from: limits.lowBelow,
          to: limits.highFrom,
          color: bandColor('medium', limits),
          thickness: BAND_THICKNESS,
        },
        {
          from: limits.highFrom,
          to: 100,
          color: bandColor('high', limits),
          thickness: BAND_THICKNESS,
        },
      ],
    },
    series: [
      {
        type: 'gauge',
        name: 'Usage',
        data: [clampedPercent],
        dataLabels: { enabled: false },
        dial: {
          radius: '62%',
          backgroundColor: needleColor,
          baseWidth: 5,
          baseLength: '0%',
          rearLength: '0%',
        },
        pivot: { backgroundColor: needleColor, radius: 5 },
      },
    ],
  };
}
