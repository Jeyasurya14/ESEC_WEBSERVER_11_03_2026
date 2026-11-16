import { ChartFixture } from '../../../testing/chart-fixture';
import { heatmapSeries, groupHeatmapPoints } from './heatmap-chart.utils';
import { instance } from '../../../testing/instances';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Options } from 'highcharts';
import { By } from '@angular/platform-browser';
import { HighchartsChartComponent } from 'highcharts-angular';
import { describe, expect, it } from 'vitest';
import { HeatmapChart } from './heatmap-chart';
import { heatmapChartOptions } from './heatmap-options';
import { DEFAULT_HEATMAP_COLORS } from '../report-settings.service';
import { formatSqlDate } from '../dates';
import { provideHighchartsCharts } from './highcharts.config';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'highcharts-chart',
  template: '',
})
class ChartStub {
  readonly options = input.required<Options>();
}

describe('Heatmap matrix viewport', () => {
  it('renders the shared matrix cells with real Highcharts', async () => {
    TestBed.configureTestingModule({ providers: [provideHighchartsCharts()] });
    const rows = Array.from({ length: 3 * 24 }, (_, index) => ({
      c_date: formatSqlDate(new Date(2026, 0, Math.floor(index / 24) + 1)),
      c_hour: String(index % 24),
      p_qty_p: 70,
    }));
    const fixture = TestBed.createComponent(HeatmapChart);
    fixture.componentRef.setInput('options', heatmapChartOptions(rows, DEFAULT_HEATMAP_COLORS));
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const points = element.querySelectorAll('.highcharts-heatmap-series .highcharts-point');
    expect(points.length).toBeGreaterThan(0);
    expect(points.length).toBe(72);
    expect(
      Number(element.querySelector('svg.highcharts-root')!.getAttribute('height')),
    ).toBeLessThan(1000);
    fixture.destroy();
  }, 15_000);
  it('keeps the Date and 24 hour headers in the same isolated scroll region as the chart', async () => {
    TestBed.overrideComponent(HeatmapChart, {
      remove: { imports: [HighchartsChartComponent] },
      add: { imports: [ChartStub] },
    });
    const fixture = TestBed.createComponent(HeatmapChart);
    fixture.componentRef.setInput('options', { chart: { type: 'heatmap' }, series: [] });
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    const viewport = element.querySelector<HTMLElement>('.matrix-scroll')!;
    const header = viewport.querySelector<HTMLElement>('.matrix-header')!;
    expect([...header.querySelectorAll('span')].map((span) => span.textContent?.trim())).toEqual([
      'Date',
      ...Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, '0')),
    ]);
    expect(viewport.querySelector('highcharts-chart')).not.toBeNull();
    expect(getComputedStyle(viewport).overflow).toBe('auto');
    expect(getComputedStyle(header).position).toBe('sticky');
    expect(getComputedStyle(viewport).position).toBe('relative');
  });

  it('bounds a full-year matrix while scrolling and filtering, and exports all dates', async () => {
    TestBed.overrideComponent(HeatmapChart, {
      remove: { imports: [HighchartsChartComponent] },
      add: { imports: [ChartStub] },
    });
    const rows = Array.from({ length: 360 }, (_, day) => {
      const date = formatSqlDate(new Date(2026, 0, day + 1));
      return Array.from({ length: 24 }, (_, hour) => ({
        c_date: date,
        c_hour: String(hour),
        p_qty_p: 70,
        p_qty_a: 40,
      }));
    }).flat();
    const fixture = TestBed.createComponent(HeatmapChart);
    const options = heatmapChartOptions(rows, DEFAULT_HEATMAP_COLORS);
    fixture.componentRef.setInput('options', options);
    await fixture.whenStable();
    const chart = () =>
      instance(
        fixture.debugElement.query(By.directive(ChartStub)).componentInstance,
        ChartStub,
      ).options();
    const points = () => [...groupHeatmapPoints(chart()).values()].flat();
    expect(points().length).toBeLessThanOrEqual(864);
    expect(heatmapSeries(chart().exporting?.chartOptions ?? {})?.data).toHaveLength(8640);
    expect(chart().exporting?.chartOptions?.yAxis).toMatchObject({ min: 0, max: 359 });
    const viewport = instance(fixture.nativeElement.querySelector('.matrix-scroll'), HTMLElement);
    Object.defineProperty(viewport, 'clientHeight', { value: 640 });
    viewport.scrollTop = 360 * 23 + 4 + 28 - 640;
    viewport.dispatchEvent(new Event('scroll'));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await fixture.whenStable();
    const axis = chart().yAxis;
    expect((Array.isArray(axis) ? axis[0] : axis)?.min).toBeGreaterThan(300);
    expect(points().some((point) => point.y === 359)).toBe(true);
    expect(points().length).toBeLessThanOrEqual(864);
    const dataRows: string[][] = [];
    using exported = new ChartFixture();
    chart().chart!.events!.exportData!.call(exported.chart, { dataRows });
    expect(dataRows).toHaveLength(361);
    expect(dataRows[0]).toHaveLength(25);
    expect(dataRows.at(-1)).toEqual([
      formatSqlDate(new Date(2026, 0, 360)),
      ...Array(24).fill('70'),
    ]);
    fixture.componentRef.setInput(
      'options',
      heatmapChartOptions(rows, DEFAULT_HEATMAP_COLORS, {
        hiddenBands: ['from60To70'],
        showUsed: true,
        dateDescending: true,
      }),
    );
    await fixture.whenStable();
    expect(points().every((point) => point.value === null)).toBe(true);
    expect(points().length).toBeLessThanOrEqual(864);
    expect(heatmapSeries(options)?.data).toHaveLength(8640);
    fixture.destroy();
  });
});
