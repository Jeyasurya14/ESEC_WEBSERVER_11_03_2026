import { inputValue, isOption } from '../../../shared/input-value';
import {
  DETAIL_CHOICES,
  DetailSelectField,
  DetailLayout,
  defaultLayout,
  detailGridRows,
  detailLinkFields,
  detailRows,
  detailUsageStats,
  selectedDetailRows,
} from './license-detail.utils';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { BrowserStorage } from '../../../core/storage/browser-storage.service';
import { formatSqlDate } from '../../../shared/dates';
import { CheckFilter } from '../../../shared/filters/check-filter';
import { HeatmapControls } from '../../../shared/charts/heatmap-controls';
import { SearchFilter } from '../../../shared/filters/search-filter';
import { DataGrid } from '../../../shared/grid/data-grid';
import { ReportChart } from '../../../shared/report-chart/report-chart';
import { ReportData, combinedLastUpdated, sqlQuery } from '../../../shared/report-data';
import { registerReportRefresh } from '../../../shared/report-refresh';
import { DEFAULT_REPORT_SETTINGS, ReportSettings } from '../../../shared/report-settings.service';
import { LicenseRecord, recordColumns } from '../report-helpers';
import {
  reportDates,
  reportParameter,
  reportTimes,
  ReportControls,
} from '../../../shared/status-bar/report-controls';
import { OrganizationRow } from '../organization/organization.data';
import { DrilldownRange } from '../drilldown/drilldown-range';
import {
  DEFAULT_SUMMARY_SERIES,
  SUMMARY_SERIES,
  SummarySeriesId,
} from '../summary/license-summary.data';
import { detailColumns, detailLinks } from './detail-columns';
import { detailChart, DetailChartOptions } from './detail-charts';
import {
  DETAIL_DEFINITIONS,
  debugSessionQuery,
  detailQuery,
  DetailParameters,
  DetailView,
} from './detail-queries';

export { DEFAULT_REPORT_SETTINGS as DEFAULT_DETAIL_SETTINGS } from '../../../shared/report-settings.service';
const DEFAULT_DETAIL_SETTINGS = DEFAULT_REPORT_SETTINGS;

const DEFAULT_PARAMETERS: DetailParameters = {
  start: '',
  end: '',
  startTime: '00:00',
  endTime: '23:59',
  workingDays: false,
  workingHours: 24,
  businessHours: false,
  granularity: 'date',
  usageView: 'summary',
  checkoutView: 'date',
  category: 'date',
  reduction: 1,
  newCalculation: false,
};

const DEFAULT_CHART_SETTINGS: DetailChartOptions = {
  percentage: false,
  visible: [...DEFAULT_SUMMARY_SERIES],
  labels: false,
  overlap: false,
  percentile: 95,
  linear: false,
  polynomial: 0,
  capacity: 0,
  heatmapMetric: 'peak',
  minimum: 0,
  maximum: 100,
  showZero: true,
  showIssued: false,
  showUsed: false,
};

const INVALID_PARAMETERS =
  'Choose valid dates, times, working hours and a reduction of at least 1.';

interface DetailContext {
  view: DetailView;
  row: OrganizationRow;
  range: DrilldownRange;
}

/** Shared report workspace, opened directly by the navigation registry with its view and context. */
@Component({
  selector: 'app-license-detail',
  host: { '[class.heatmap-report]': "view() === 'heatmap'" },
  imports: [CheckFilter, SearchFilter, DataGrid, ReportChart, HeatmapControls],
  templateUrl: './license-detail.html',
  styleUrls: ['../license-controls.scss', './license-detail.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LicenseDetail {
  protected readonly inputValue = inputValue;

  readonly view = input.required<DetailView>();
  readonly row = input.required<OrganizationRow>();
  readonly range = input.required<DrilldownRange>();
  readonly settings = input<ReportSettings>(DEFAULT_DETAIL_SETTINGS);
  protected readonly mainData = new ReportData<LicenseRecord>();
  protected readonly extraData = new ReportData<LicenseRecord>();
  private readonly storage = inject(BrowserStorage);
  protected readonly reportInfo = computed(() => DETAIL_DEFINITIONS[this.view()]);
  /** Opening a different view, row or range starts this workspace afresh. */
  private readonly context = computed<DetailContext>(() => ({
    view: this.view(),
    row: this.row(),
    range: this.range(),
  }));
  protected readonly parameters = linkedSignal<
    { context: DetailContext; hours: number },
    DetailParameters
  >({
    source: () => ({ context: this.context(), hours: this.settings().workingHoursPerDay }),
    computation: ({ context, hours }, previous) => {
      const workingHours = reportParameter(
        this.storage,
        context.view === 'longDuration' ? 'longDuration' : 'usageHours',
        hours,
      );
      // A settings-only change updates the hours and keeps the user's other edits.
      if (previous?.source.context === context) {
        return { ...previous.value, workingHours };
      }
      return {
        ...(previous?.value ?? DEFAULT_PARAMETERS),
        ...reportDates(this.storage, {
          start: formatSqlDate(context.range.startDate),
          end: formatSqlDate(context.range.endDate),
        }),
        ...reportTimes(this.storage),
        workingHours,
        workingDays: context.view === 'heatmap',
        granularity:
          context.view === 'hours' || context.view === 'utilizationHours' ? 'month' : 'date',
      };
    },
  });
  protected readonly chartSettings = signal<DetailChartOptions>({
    ...DEFAULT_CHART_SETTINGS,
    percentile: reportParameter(this.storage, 'percentile', 95),
  });
  protected readonly searchText = signal('');
  protected readonly layout = linkedSignal<DetailContext, DetailLayout>({
    source: this.context,
    computation: ({ view }) => defaultLayout(view),
  });
  protected readonly groupField = signal('');
  protected readonly selectedRow = linkedSignal<DetailContext, LicenseRecord | null>({
    source: this.context,
    computation: () => null,
  });
  protected readonly selectedUser = linkedSignal<DetailContext, string>({
    source: this.context,
    computation: () => '',
  });
  protected readonly chartSeries = SUMMARY_SERIES;
  private readonly mainQuery = computed(() =>
    detailQuery(this.view(), this.row(), this.parameters()),
  );
  private readonly extraQuery = computed(() =>
    this.view() === 'debugData' && this.selectedRow()
      ? debugSessionQuery(this.selectedRow()!, this.parameters())
      : detailQuery(this.view(), this.row(), this.parameters(), true),
  );
  protected readonly rows = computed(() =>
    detailRows(
      this.mainData.rows(),
      this.view(),
      this.parameters(),
      this.row().lic,
      this.selectedUser(),
    ),
  );
  protected readonly gridRows = computed(() =>
    detailGridRows(this.rows(), this.view(), this.parameters().usageView, this.groupField()),
  );
  protected readonly columns = computed(() => {
    const columns = this.groupField()
      ? recordColumns(this.gridRows())
      : detailColumns(this.view(), this.gridRows(), this.settings(), this.parameters());
    return detailLinks(columns, detailLinkFields(this.view(), this.groupField()), (row) =>
      this.selectRow(row),
    );
  });
  protected readonly extraColumns = computed(() => recordColumns(this.extraData.rows()));
  protected readonly chartData = computed(() =>
    this.view() === 'utilizationHours' ? this.extraData : this.mainData,
  );
  protected readonly chartOptions = computed(() =>
    detailChart(
      this.view(),
      this.chartData().rows(),
      this.parameters(),
      this.chartSettings(),
      this.settings(),
    ),
  );
  protected readonly selectedRows = computed(() =>
    selectedDetailRows(this.rows(), this.selectedRow(), this.view(), this.groupField()),
  );
  protected readonly selectedColumns = computed(() => recordColumns(this.selectedRows()));
  protected readonly usageStats = computed(() =>
    detailUsageStats(this.chartData().rows(), this.rows()),
  );

  constructor() {
    this.mainData.bind(() =>
      sqlQuery(this.mainQuery(), { kind: 'invalid', message: INVALID_PARAMETERS }),
    );
    this.extraData.bind(() => sqlQuery(this.extraQuery(), { kind: 'idle' }));
    registerReportRefresh(
      {
        loading: () => this.mainData.loading() || this.extraData.loading(),
        lastUpdated: () =>
          combinedLastUpdated(
            this.extraQuery() ? [this.mainData, this.extraData] : [this.mainData],
          ),
      },
      () => this.refresh(),
      () => this.statusControls(),
    );
  }
  private statusControls(): ReportControls {
    const view = this.view();
    const showTimes =
      this.reportInfo().times &&
      (view !== 'checkoutUser' || this.parameters().checkoutView === 'time') &&
      (view !== 'qos' || this.parameters().businessHours);
    const hours = ['month', 'hours', 'date'].includes(view);
    const percentile = view === 'history' || view === 'qos';
    const duration = view === 'longDuration';
    return {
      dates: {
        value: () => ({ start: this.parameters().start, end: this.parameters().end }),
        set: (dates) => {
          this.selectedRow.set(null);
          this.parameters.update((reportOptions) => ({ ...reportOptions, ...dates }));
        },
      },
      ...(showTimes
        ? {
            times: {
              value: () => ({
                startTime: this.parameters().startTime,
                endTime: this.parameters().endTime,
              }),
              set: (times) =>
                this.parameters.update((reportOptions) => ({ ...reportOptions, ...times })),
            },
          }
        : {}),
      ...(hours || percentile || duration
        ? {
            parameters: {
              value: () => ({
                ...(hours ? { usageHours: this.parameters().workingHours } : {}),
                ...(percentile ? { percentile: this.chartSettings().percentile } : {}),
                ...(duration ? { longDuration: this.parameters().workingHours } : {}),
              }),
              set: (values) => {
                if (values.usageHours !== undefined || values.longDuration !== undefined)
                  this.parameters.update((reportOptions) => ({
                    ...reportOptions,
                    workingHours: values.longDuration ?? values.usageHours!,
                  }));
                if (values.percentile !== undefined)
                  this.changeChart('percentile', values.percentile);
              },
            },
          }
        : {}),
    };
  }
  protected changeSelect<K extends DetailSelectField>(option: K, value: string): void {
    if (isOption(DETAIL_CHOICES[option], value)) this.change(option, value);
  }
  protected setLayout(value: string): void {
    if (value === 'grid' || value === 'chart' || value === 'split') this.layout.set(value);
  }
  protected change<K extends keyof DetailParameters>(
    optionName: K,
    value: DetailParameters[K],
  ): void {
    this.selectedRow.set(null);
    if (optionName === 'usageView') this.groupField.set('');
    this.parameters.update((reportOptions) => ({ ...reportOptions, [optionName]: value }));
  }
  protected changeChart<K extends keyof DetailChartOptions>(
    optionName: K,
    value: DetailChartOptions[K],
  ): void {
    if (typeof value === 'number' && !Number.isFinite(value)) return;
    if (optionName === 'percentile' && (Number(value) < 0 || Number(value) > 100)) return;
    if (optionName === 'capacity' && Number(value) < 0) return;
    this.chartSettings.update((chartOptions) => ({ ...chartOptions, [optionName]: value }));
  }
  protected toggleSeries(seriesId: SummarySeriesId): void {
    const visibleSeries = this.chartSettings().visible;
    this.changeChart(
      'visible',
      visibleSeries.includes(seriesId)
        ? visibleSeries.filter((item) => item !== seriesId)
        : [...visibleSeries, seriesId],
    );
  }
  protected selectRow(row: LicenseRecord): void {
    if (this.view() === 'usage' && row['user_id']) {
      this.selectedUser.set(String(row['user_id']));
      this.change('usageView', 'daywise');
    } else if (this.view() === 'debugData' || this.groupField()) this.selectedRow.set(row);
  }
  protected refresh(refreshExtraReport = false): void {
    if (refreshExtraReport) {
      this.extraData.refresh();
      return;
    }
    this.mainData.refresh();
    if (this.extraQuery()) this.extraData.refresh();
  }
}
