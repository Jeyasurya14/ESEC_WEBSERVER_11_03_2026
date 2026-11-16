import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HighchartsChartComponent } from 'highcharts-angular';
import { describe, expect, it } from 'vitest';
import { DEFAULT_HEATMAP_COLORS } from '../report-settings.service';
import { provideHighchartsCharts } from './highcharts.config';
import { heatmapChartOptions } from './heatmap-options';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HighchartsChartComponent],
  template: `<highcharts-chart
    [options]="options"
    style="display:block;width:600px;height:400px"
  />`,
})
class HeatmapHost {
  options = heatmapChartOptions(
    [{ c_date: '2026-11-01', c_hour: '09', p_qty_p: 75, qty_i: 4, qty_p: 3 }],
    DEFAULT_HEATMAP_COLORS,
    { labels: true, showUsed: true, showIssued: true },
  );
}

describe('Highcharts module registration', () => {
  it('loads and renders a real heatmap series with the shared application provider', async () => {
    TestBed.configureTestingModule({ providers: [provideHighchartsCharts()] });
    const fixture = TestBed.createComponent(HeatmapHost);
    // jsdom has no layout measurements; supply deterministic plot dimensions.
    fixture.componentInstance.options.chart = {
      ...fixture.componentInstance.options.chart,
      width: 600,
      height: 400,
      margin: [20, 150, 50, 100],
    };
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.querySelector('.highcharts-heatmap-series .highcharts-point')).not.toBeNull();
    expect(element.querySelector('svg.highcharts-root')).not.toBeNull();
    expect(element.querySelector('.highcharts-data-labels')?.textContent).toContain('3 / 4');
    expect(element.querySelector('.highcharts-data-labels')?.textContent).toContain('75%');
  });
});
