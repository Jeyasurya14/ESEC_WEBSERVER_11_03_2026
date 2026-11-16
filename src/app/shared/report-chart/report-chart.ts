import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Options } from 'highcharts';
import { HighchartsChartComponent } from 'highcharts-angular';
import { HeatmapChart } from '../charts/heatmap-chart';

/** Minimal read-only state; chart rendering never owns or changes the report's data. */
export interface ReportChartSource {
  loading: () => boolean;
  error: () => string;
  rows: () => readonly unknown[];
}

@Component({
  selector: 'app-report-chart',
  host: { '[class.matrix]': "options().chart?.type === 'heatmap'" },
  imports: [HighchartsChartComponent, HeatmapChart],
  template: `
    @if (source().loading()) {
      <p class="report-message" role="status">Loading {{ label() }}…</p>
    } @else if (source().error()) {
      <div class="report-message" role="alert">
        <p>{{ source().error() }}</p>
        <button type="button" (click)="retry.emit()">Retry</button>
      </div>
    } @else if (!source().rows().length) {
      <p class="report-message" role="status">No data to show.</p>
    } @else {
      <ng-content />
      @if (options().chart?.type === 'heatmap') {
        <app-heatmap-chart [options]="options()" />
      } @else {
        <highcharts-chart [options]="options()" />
      }
    }
  `,
  styleUrl: '../report-content.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportChart {
  readonly source = input.required<ReportChartSource>();
  readonly options = input.required<Options>();
  readonly label = input('report');
  readonly retry = output<void>();
}
