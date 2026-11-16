import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { CheckFilter } from '../../../shared/filters/check-filter';
import { DataGrid } from '../../../shared/grid/data-grid';
import { registerReportRefresh } from '../../../shared/report-refresh';
import { ReportSettings } from '../../../shared/report-settings.service';
import { OrganizationRow } from '../organization/organization.data';
import { LicenseSummaryChart } from './license-summary-chart';
import { SummaryLoader } from './summary-loader';
import {
  DEFAULT_SUMMARY_SERIES,
  SUMMARY_SERIES,
  SummaryMode,
  SummaryPeriod,
  SummarySeriesId,
  summaryCall,
  summaryIndicatorColumns,
  summaryIndicators,
} from './license-summary.data';
import { LicenseScope } from '../grouped-reports';

let nextSummaryId = 0;

@Component({
  selector: 'app-license-summary',
  imports: [CheckFilter, DataGrid, LicenseSummaryChart],
  providers: [SummaryLoader],
  templateUrl: './license-summary.html',
  styleUrls: ['./license-summary-panel.scss', './license-summary.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LicenseSummary {
  protected readonly instanceId = ++nextSummaryId;
  readonly row = input.required<OrganizationRow>();
  readonly scope = input.required<LicenseScope>();
  readonly title = input.required<string>();
  readonly settings = input.required<ReportSettings>();
  protected readonly summaryData: SummaryLoader = inject(SummaryLoader);
  protected readonly chartMode = signal<SummaryMode>('value');
  protected readonly visibleSeries = signal<readonly SummarySeriesId[]>([
    ...DEFAULT_SUMMARY_SERIES,
  ]);
  protected readonly expandedPanel = signal<SummaryPeriod | 'indicators' | null>(null);
  protected readonly chartSeries = computed(() =>
    SUMMARY_SERIES.filter((series) => this.chartMode() === 'value' || series.id !== 'ISSUED'),
  );
  protected readonly indicators = computed(() =>
    summaryIndicators(
      this.summaryData.indicators.rows(),
      this.scope(),
      this.settings().workingHoursPerDay,
    ),
  );
  protected readonly columns = computed(() => summaryIndicatorColumns(this.settings()));

  constructor() {
    effect(() => {
      const row = this.row();
      const scope = this.scope();
      untracked(() => void this.summaryData.load(row, scope));
    });
    registerReportRefresh(
      this.summaryData,
      () => void this.summaryData.load(this.row(), this.scope()),
    );
  }

  protected setMode(mode: SummaryMode): void {
    if (mode === this.chartMode()) return;
    this.chartMode.set(mode);
    this.visibleSeries.set([...DEFAULT_SUMMARY_SERIES]);
  }

  protected toggleSeries(id: SummarySeriesId): void {
    this.visibleSeries.update((selected) =>
      selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id],
    );
  }

  protected togglePanel(id: SummaryPeriod | 'indicators'): void {
    this.expandedPanel.update((current) => (current === id ? null : id));
  }

  protected retry(section: SummaryPeriod | 'indicators'): void {
    const source =
      section === 'indicators'
        ? this.summaryData.indicators
        : this.summaryData.charts.find((chart) => chart.id === section)?.data;
    if (source) void source.load(summaryCall(this.scope(), this.row(), section));
  }
}
