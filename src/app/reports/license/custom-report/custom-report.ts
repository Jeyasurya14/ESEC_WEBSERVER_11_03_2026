import { inputValue } from '../../../shared/input-value';
import {
  featureOptions,
  visibleFeatures,
  updateFeatureSelection,
  sessionFeatureKeys,
} from './custom-report.utils';
import { apiRequest, resourceRequest } from '../../../core/api/api-request';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked,
  Injector,
} from '@angular/core';

import { ApiService, sqlString } from '../../../core/api/api.service';
import { UserMenu } from '../../../core/models';
import { Dropdown } from '../../../shared/dropdown/dropdown';
import { CheckFilter } from '../../../shared/filters/check-filter';
import { SearchFilter } from '../../../shared/filters/search-filter';
import { ReportFilters } from '../../../shared/filters/report-filters';
import { DataGrid } from '../../../shared/grid/data-grid';
import { ReportData } from '../../../shared/report-data';
import {
  LicenseRecord,
  isoDate,
  recordColumns,
  registerLicenseRefresh,
  validPeriod,
} from '../report-helpers';
import {
  ReportFeature,
  CUSTOM_REPORT_VIEWS,
  CustomReportView,
  customReportCall,
  customPercentiles,
  featureId,
  prepareCustomHours,
  sessionSaveCall,
} from './custom-report.data';
import { LicenseChart } from '../license-chart';
import { BrowserStorage } from '../../../core/storage/browser-storage.service';
import { reportDates, reportParameter } from '../../../shared/status-bar/report-controls';

@Component({
  selector: 'app-custom-report',
  imports: [DataGrid, Dropdown, CheckFilter, SearchFilter, LicenseChart],
  templateUrl: './custom-report.html',
  styleUrl: '../license-controls.scss',
  host: { class: 'report-page report-fill' },
  providers: [ReportData, ReportFilters],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomReport implements OnInit {
  protected readonly inputValue = inputValue;

  private readonly injector = inject(Injector);

  readonly menu = input.required<UserMenu>();
  readonly initialFeatures = input<ReportFeature[]>([]);
  readonly initialView = input<CustomReportView>('Utilization');
  readonly initialDetails = input(false);
  readonly initialChart = input(false);
  readonly reportData = inject<ReportData<LicenseRecord>>(ReportData);
  readonly filters = inject(ReportFilters);
  private readonly api = inject(ApiService);
  private readonly storage = inject(BrowserStorage);
  readonly allFeatures = signal<ReportFeature[]>([]);
  readonly selectedFeatureIds = signal<ReadonlySet<string>>(new Set());
  readonly featureSearch = signal('');
  readonly selectedSoftware = signal('');
  readonly selectedServer = signal('');
  readonly searchText = signal('');
  readonly reportView = signal<CustomReportView>('Utilization');
  readonly reportViews = CUSTOM_REPORT_VIEWS;
  readonly startDate = signal(isoDate(new Date(new Date().getFullYear(), 0, 1)));
  readonly endDate = signal(isoDate(new Date()));
  readonly workingDaysOnly = signal(true);
  readonly showDetails = signal(false);
  readonly percentileRank = signal(95);
  readonly latestQuantities = signal<LicenseRecord[]>([]);
  private percentileRequestId = 0;
  readonly usageMode = signal<'svr_ftr' | 'ftr' | 'join'>('svr_ftr');
  readonly usageOptions = [
    { value: 'svr_ftr', label: 'Server / Feature' },
    { value: 'ftr', label: 'Feature' },
    { value: 'join', label: 'Join' },
  ];
  readonly savedSessions = signal<LicenseRecord[]>([]);
  readonly selectedSessionId = signal('');
  readonly sessionName = signal('');
  readonly statusMessage = signal('');
  readonly isSavingSession = signal(false);
  readonly featuresLoading = signal(true);
  readonly rowCount = signal('');
  readonly showChart = signal(false);
  private sessionRequestId = 0;
  private isWritingSession = false;
  private featureRequestId = 0;
  readonly featureId = featureId;
  setRank(value: string): void {
    this.percentileRank.set(Math.min(100, Math.max(1, Number(value) || 95)));
  }
  readonly softwareOptions = computed(() => featureOptions(this.allFeatures(), 'sw'));
  readonly serverOptions = computed(() =>
    featureOptions(this.allFeatures(), 'server', this.selectedSoftware()),
  );
  readonly visibleFeatures = computed(() =>
    visibleFeatures(
      this.allFeatures(),
      this.selectedSoftware(),
      this.selectedServer(),
      this.featureSearch(),
    ),
  );
  readonly chosenFeatures = computed(() =>
    this.allFeatures().filter((row) => this.selectedFeatureIds().has(featureId(row))),
  );
  readonly sessionOptions = computed(() => [
    { value: '', label: 'Select saved session' },
    ...this.savedSessions().map((row) => ({
      value: String(row['no']),
      label: String(row['session']),
    })),
  ]);
  readonly rows = computed(() =>
    this.reportView() === 'Percentile'
      ? customPercentiles(
          this.reportData.rows(),
          this.percentileRank(),
          this.showDetails(),
          this.latestQuantities(),
        )
      : this.reportData.rows(),
  );
  readonly columns = computed(() => recordColumns(this.rows()));
  constructor() {
    effect(() => {
      const features = this.initialFeatures();
      const view = this.initialView();
      const details = this.initialDetails();
      const chart = this.initialChart();
      untracked(() => {
        if (features.length) {
          this.allFeatures.set(features);
          this.selectedFeatureIds.set(new Set(features.map(featureId)));
        }
        this.reportView.set(view);
        this.showDetails.set(details);
        this.showChart.set(chart);
      });
    });
    effect(() => {
      this.reportView();
      this.selectedFeatureIds();
      this.startDate();
      this.endDate();
      this.workingDaysOnly();
      this.showDetails();
      this.usageMode();
      if (this.filters.settings()) untracked(() => this.refresh());
    });
    registerLicenseRefresh(
      this.reportData,
      () => this.refresh(),
      () => ({
        dates: {
          value: () => ({ start: this.startDate(), end: this.endDate() }),
          set: (dates) => {
            this.startDate.set(dates.start);
            this.endDate.set(dates.end);
          },
        },
        ...(this.filters.settings()
          ? {
              parameters: {
                value: () => ({
                  usageHours: this.filters.settings()!.workingHoursPerDay,
                  ...(this.reportView() === 'Percentile'
                    ? { percentile: this.percentileRank() }
                    : {}),
                }),
                set: (values) => {
                  if (values.usageHours !== undefined)
                    this.filters.settings.update(
                      (settings) =>
                        settings && { ...settings, workingHoursPerDay: values.usageHours! },
                    );
                  if (values.percentile !== undefined) this.percentileRank.set(values.percentile);
                },
              },
            }
          : {}),
      }),
    );
  }
  ngOnInit(): void {
    void this.filters.start().then((settingsLoaded) => {
      if (!settingsLoaded) this.reportData.fail(this.filters.error());
      else {
        this.percentileRank.set(reportParameter(this.storage, 'percentile', 95));
        const dates = reportDates(this.storage, { start: this.startDate(), end: this.endDate() });
        this.startDate.set(dates.start);
        this.endDate.set(dates.end);
      }
    });
    void this.loadFeatures();
    void this.loadSessions();
  }
  async loadFeatures(): Promise<void> {
    const requestId = ++this.featureRequestId;
    this.featuresLoading.set(true);
    try {
      const parameters = await this.read<ReportFeature>(
        'call esms_m.r_report_view_1_select_parameters();',
      );
      if (requestId !== this.featureRequestId) return;
      this.allFeatures.set(parameters);
      const allowed = new Set(parameters.map(featureId));
      this.selectedFeatureIds.update(
        (keys) => new Set([...keys].filter((featureId) => allowed.has(featureId))),
      );
    } catch (error) {
      if (requestId !== this.featureRequestId) return;
      this.statusMessage.set(
        error instanceof Error ? error.message : 'Unable to load report parameters.',
      );
    } finally {
      if (requestId === this.featureRequestId) this.featuresLoading.set(false);
    }
  }
  toggleFeature(feature: ReportFeature): void {
    this.selectedFeatureIds.update((keys) => {
      const updatedIds = new Set(keys);
      const selectedId = featureId(feature);
      if (updatedIds.has(selectedId)) updatedIds.delete(selectedId);
      else updatedIds.add(selectedId);
      return updatedIds;
    });
  }
  selectVisible(select: boolean): void {
    this.selectedFeatureIds.update((keys) =>
      updateFeatureSelection(keys, this.visibleFeatures(), select),
    );
  }
  chooseSoftware(software: string): void {
    this.selectedSoftware.set(software);
    this.selectedServer.set('');
  }
  chooseUsageMode(mode: string): void {
    if (mode === 'svr_ftr' || mode === 'ftr' || mode === 'join') this.usageMode.set(mode);
  }
  refresh(): void {
    const requestId = ++this.percentileRequestId;
    if (!this.chosenFeatures().length) {
      this.reportData.clear();
      return;
    }
    if (!validPeriod(this.startDate(), this.endDate())) {
      this.reportData.fail('Choose valid dates with the start before the end.');
      return;
    }
    const settings = this.filters.settings();
    if (!settings) return;
    if (this.reportView() === 'Percentile') {
      const payload = JSON.stringify(
        this.chosenFeatures().map((row) => ({ svr: row.server, ftr: row.lic })),
      );
      const suffix = this.showDetails() ? 'c' : 'p';
      this.latestQuantities.set([]);
      void this.read<LicenseRecord>(
        `call esms_m.r_report_view_1_percentile_${suffix}_qty_i(${sqlString(payload)});`,
      )
        .then((rows) => {
          if (requestId === this.percentileRequestId) this.latestQuantities.set(rows);
        })
        .catch(() => {
          if (requestId === this.percentileRequestId)
            this.statusMessage.set(
              'Latest issued quantities could not be loaded. Refresh to retry.',
            );
        });
    }
    void this.reportData.load(
      customReportCall({
        view: this.reportView(),
        start: this.startDate(),
        end: this.endDate(),
        features: this.chosenFeatures(),
        workingDays: this.workingDaysOnly(),
        details: this.showDetails(),
        workingHours: settings.workingHoursPerDay,
        usageMode: this.usageMode(),
      }),
      (rows) => prepareCustomHours(rows, settings.workingHoursPerDay),
    );
  }
  async loadSessions(): Promise<void> {
    try {
      this.savedSessions.set(
        await this.read<LicenseRecord>(
          `call esms_m.r_report_view_1_load(${sqlString(this.reportData.userId())});`,
        ),
      );
    } catch (error) {
      this.statusMessage.set(
        error instanceof Error ? error.message : 'Unable to load saved sessions.',
      );
    }
  }
  async loadSession(sessionId: string): Promise<void> {
    if (this.isWritingSession) return;
    this.selectedSessionId.set(sessionId);
    const requestId = ++this.sessionRequestId;
    if (!sessionId) {
      this.isSavingSession.set(false);
      this.sessionName.set('');
      this.statusMessage.set('');
      return;
    }
    this.isSavingSession.set(true);
    try {
      const rows = await this.read<LicenseRecord>(
        `call esms_m.r_report_view_1_load_1(${sqlString(sessionId)});`,
      );
      if (requestId !== this.sessionRequestId) return;
      this.selectedFeatureIds.set(
        sessionFeatureKeys(String(rows[0]?.['output'] ?? '[]'), this.allFeatures()),
      );
      this.sessionName.set(
        String(
          this.savedSessions().find((row) => String(row['no']) === sessionId)?.['session'] ?? '',
        ),
      );
      this.statusMessage.set('Session loaded.');
    } catch (error) {
      if (requestId === this.sessionRequestId)
        this.statusMessage.set(error instanceof Error ? error.message : 'Unable to load session.');
    } finally {
      if (requestId === this.sessionRequestId) this.isSavingSession.set(false);
    }
  }
  async saveSession(): Promise<void> {
    if (!this.sessionName().trim() || !this.chosenFeatures().length || this.isSavingSession())
      return;
    this.isSavingSession.set(true);
    this.isWritingSession = true;
    try {
      await this.write(
        sessionSaveCall(this.reportData.userId(), this.sessionName(), this.chosenFeatures()),
      );
      this.statusMessage.set('Session saved.');
      await this.loadSessions();
    } catch (error) {
      this.statusMessage.set(error instanceof Error ? error.message : 'Unable to save session.');
    } finally {
      this.isSavingSession.set(false);
      this.isWritingSession = false;
    }
  }
  async deleteSession(): Promise<void> {
    if (!this.selectedSessionId() || this.isSavingSession()) return;
    if (!window.confirm(`Delete saved session "${this.sessionName()}"?`)) return;
    this.isSavingSession.set(true);
    this.isWritingSession = true;
    try {
      await this.write(
        [`call esms_m.r_report_view_1_delete(${sqlString(this.selectedSessionId())});`],
        'post_delete',
      );
      this.selectedSessionId.set('');
      this.sessionName.set('');
      await this.loadSessions();
      this.statusMessage.set('Session deleted.');
    } catch (error) {
      this.statusMessage.set(error instanceof Error ? error.message : 'Unable to delete session.');
    } finally {
      this.isSavingSession.set(false);
      this.isWritingSession = false;
    }
  }
  private async read<T>(sql: string): Promise<T[]> {
    const response = await resourceRequest(this.injector, (abortSignal) =>
      apiRequest(this.api.call<T[]>(sql), abortSignal),
    );
    if (response.status !== 'PASS' || !Array.isArray(response.message))
      throw new Error(
        typeof response.message === 'string' ? response.message : 'Unable to load report data.',
      );
    return response.message;
  }
  private async write(sql: string | string[], endpoint = 'post_insert_update'): Promise<void> {
    const response = await apiRequest(this.api.post<unknown>(endpoint, { sql }));
    if (response.status !== 'PASS')
      throw new Error(
        typeof response.message === 'string' ? response.message : 'Unable to save changes.',
      );
  }
}
