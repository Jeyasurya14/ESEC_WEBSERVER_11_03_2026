import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { CheckFilter } from '../../../shared/filters/check-filter';
import { ReportChart } from '../../../shared/report-chart/report-chart';
import { ReportData } from '../../../shared/report-data';
import { summaryChartOptions, summaryChartRows } from './summary-chart-options';
import { SummaryMode, SummaryPeriod, SummaryRecord, SummarySeriesId } from './license-summary.data';

/** One reusable panel for all four time horizons. Its controls never refetch chart data. */
@Component({
  selector: 'app-license-summary-chart',
  imports: [CheckFilter, ReportChart],
  template: `
    <header class="panel-header">
      <h2>{{ title() }}</h2>
      <button
        type="button"
        class="panel-action"
        [attr.aria-label]="(expanded() ? 'Restore ' : 'Expand ') + title()"
        [attr.aria-pressed]="expanded()"
        (click)="expand.emit()"
      >
        {{ expanded() ? 'Restore' : 'Expand' }}
      </button>
    </header>
    <div class="panel-controls" role="group" [attr.aria-label]="title() + ' controls'">
      @if (period() === 'day') {
        <app-check-filter
          label="Working Days"
          [checked]="workingDaysOnly()"
          (toggled)="workingDaysOnly.set(!workingDaysOnly())"
        />
      }
      <app-check-filter label="Labels" [checked]="labels()" (toggled)="labels.set(!labels())" />
      <app-check-filter
        label="Allow overlap"
        [checked]="overlap()"
        (toggled)="overlap.set(!overlap())"
      />
    </div>
    <app-report-chart
      [source]="chartSource"
      [options]="options()"
      [label]="title()"
      (retry)="retry.emit()"
    />
  `,
  styleUrl: './license-summary-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LicenseSummaryChart {
  readonly title = input.required<string>();
  readonly period = input.required<SummaryPeriod>();
  readonly data = input.required<ReportData<SummaryRecord>>();
  readonly mode = input.required<SummaryMode>();
  readonly visible = input.required<readonly SummarySeriesId[]>();
  readonly expanded = input(false);
  readonly expand = output<void>();
  readonly retry = output<void>();
  protected readonly workingDaysOnly = signal(false);
  protected readonly labels = signal(true);
  protected readonly overlap = signal(false);
  protected readonly chartSource = {
    loading: () => this.data().loading(),
    error: () => this.data().error(),
    rows: () =>
      summaryChartRows(this.data().rows(), this.period(), {
        workingDaysOnly: this.workingDaysOnly(),
      }),
  };
  protected readonly options = computed(() =>
    summaryChartOptions(this.data().rows(), this.period(), {
      mode: this.mode(),
      visible: this.visible(),
      workingDaysOnly: this.workingDaysOnly(),
      labels: this.labels(),
      overlap: this.overlap(),
    }),
  );

  constructor() {
    effect(() => {
      this.mode();
      untracked(() => this.workingDaysOnly.set(false));
    });
  }
}
