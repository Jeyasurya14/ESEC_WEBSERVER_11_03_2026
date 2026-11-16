import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { Options } from 'highcharts';
import { HighchartsChartComponent } from 'highcharts-angular';
import { HeatmapChart } from '../../shared/charts/heatmap-chart';
import { HeatmapControls } from '../../shared/charts/heatmap-controls';
import { Dropdown } from '../../shared/dropdown/dropdown';
import { HeatmapColorScale, ReportSettings } from '../../shared/report-settings.service';
import { heatmapChartOptions } from '../../shared/charts/heatmap-options';
import { chartRows, chartMetrics, chartMetric, licenseLineChart } from './license-chart.utils';
import { LicenseRecord } from './report-helpers';

@Component({
  selector: 'app-license-chart',
  imports: [HighchartsChartComponent, Dropdown, HeatmapControls, HeatmapChart],
  template: `
    @if (!heatmap()) {
      <div class="report-toolbar">
        <span class="filter-label">Metric</span
        ><app-dropdown
          ariaLabel="Chart metric"
          [options]="metrics()"
          [value]="chosenMetric()"
          (valueChange)="selectedMetric.set($event)"
        />
      </div>
    }
    @if (heatmap()) {
      <app-heatmap-controls
        [colors]="settings().heatmapColors"
        [(metric)]="heatmapMetric"
        [(used)]="showUsed"
        [(issued)]="showIssued"
        [(hidden)]="hiddenBands"
        [(descending)]="sortDescending"
      />
    }
    @if (plottedRows().length) {
      @if (heatmap()) {
        <app-heatmap-chart [options]="chartOptions()" />
      } @else {
        <highcharts-chart [options]="chartOptions()" />
      }
    } @else {
      <p class="empty">No data to chart.</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex: 1;
      min-height: 0;
      flex-direction: column;
      overflow: hidden;
    }
    highcharts-chart {
      display: block;
      flex: 1;
      min-height: 300px;
    }
    app-heatmap-chart {
      display: flex;
      flex: 1;
      min-height: 0;
      min-width: 0;
    }
    .empty {
      margin: auto;
      color: #62758c;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LicenseChart {
  readonly rows = input.required<LicenseRecord[]>();
  readonly settings = input.required<ReportSettings>();
  readonly heatmap = input(false);
  readonly search = input('');
  readonly plottedRows = computed(() => chartRows(this.rows(), this.search()));
  readonly selectedMetric = signal('');
  readonly hiddenBands = signal<readonly (keyof HeatmapColorScale)[]>([]);
  readonly sortDescending = signal(false);
  readonly heatmapMetric = signal<'peak' | 'average'>('peak');
  readonly showUsed = signal(false);
  readonly showIssued = signal(false);
  readonly metrics = computed(() => chartMetrics(this.plottedRows()));
  readonly chosenMetric = computed(() => chartMetric(this.metrics(), this.selectedMetric()));
  readonly chartOptions = computed<Options>(() => {
    if (this.heatmap())
      return heatmapChartOptions(this.plottedRows(), this.settings().heatmapColors, {
        metric: this.heatmapMetric(),
        showUsed: this.showUsed(),
        showIssued: this.showIssued(),
        hiddenBands: this.hiddenBands(),
        dateDescending: this.sortDescending(),
      });
    return licenseLineChart(this.plottedRows(), this.chosenMetric());
  });
}
