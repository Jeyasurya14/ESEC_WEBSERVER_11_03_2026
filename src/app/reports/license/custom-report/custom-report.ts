import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { apiRequest } from '../../../core/api/api-request';
import { ApiService, sqlString } from '../../../core/api/api.service';
import { UserMenu } from '../../../core/models';
import { toggled } from '../../../core/utils/data';
import { BrowserStorage } from '../../../core/storage/browser-storage.service';
import { Dropdown } from '../../../shared/dropdown/dropdown';
import { CheckFilter } from '../../../shared/filters/check-filter';
import { ReportFilters } from '../../../shared/filters/report-filters';
import { SearchFilter } from '../../../shared/filters/search-filter';
import { DataGrid } from '../../../shared/grid/data-grid';
import { inputValue } from '../../../shared/input-value';
import { ReportData, ReportQuery } from '../../../shared/report-data';
import {
  ReportControls,
  reportDates,
  reportParameter,
} from '../../../shared/status-bar/report-controls';
import { LicenseChart } from '../license-chart';
import {
  LicenseRecord,
  isoDate,
  recordColumns,
  registerLicenseRefresh,
  validPeriod,
} from '../report-helpers';
import {
  CUSTOM_REPORT_VIEWS,
  CustomReportView,
  ReportFeature,
  customPercentiles,
  customReportCall,
  featureId,
  prepareCustomHours,
  sessionSaveCall,
} from './custom-report.data';
import {
  featureOptions,
  sessionFeatureKeys,
  updateFeatureSelection,
  visibleFeatures,
} from './custom-report.utils';

type UsageMode = 'svr_ftr' | 'ftr' | 'join';

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
  readonly featureId = featureId;
  readonly reportViews = CUSTOM_REPORT_VIEWS;
  readonly usageOptions = [
    { value: 'svr_ftr', label: 'Server / Feature' },
    { value: 'ftr', label: 'Feature' },
    { value: 'join', label: 'Join' },
  ];

  readonly menu = input.required<UserMenu>();
  readonly initialFeatures = input<ReportFeature[]>([]);
  readonly initialView = input<CustomReportView>('Utilization');
  readonly initialDetails = input(false);
  readonly initialChart = input(false);

  private readonly api = inject(ApiService);
  private readonly storage = inject(BrowserStorage);
  private readonly destroyRef = inject(DestroyRef);
  readonly filters = inject(ReportFilters);

  // Four independent requests, each loaded from whatever its query below declares.
  readonly reportData = inject<ReportData<LicenseRecord>>(ReportData);
  private readonly featureData = new ReportData<ReportFeature>();
  private readonly sessionData = new ReportData<LicenseRecord>();
  /** The Percentile view's latest issued quantities. */
  private readonly latestQuantityData = new ReportData<LicenseRecord>();

  // Start from the inputs (e.g. when opened from Feature Groups), then follow the user's edits.
  readonly selectedFeatureIds = linkedSignal<ReadonlySet<string>>(
    () => new Set(this.initialFeatures().map(featureId)),
  );
  readonly reportView = linkedSignal(() => this.initialView());
  readonly showDetails = linkedSignal(() => this.initialDetails());
  readonly showChart = linkedSignal(() => this.initialChart());

  readonly featureSearch = signal('');
  readonly selectedSoftware = signal('');
  readonly selectedServer = signal('');
  readonly searchText = signal('');
  readonly startDate = signal(isoDate(new Date(new Date().getFullYear(), 0, 1)));
  readonly endDate = signal(isoDate(new Date()));
  readonly workingDaysOnly = signal(true);
  readonly percentileRank = signal(95);
  readonly usageMode = signal<UsageMode>('svr_ftr');
  readonly selectedSessionId = signal('');
  readonly sessionName = signal('');
  readonly statusMessage = signal('');
  readonly isSavingSession = signal(false);
  readonly rowCount = signal('');
  private sessionRequestId = 0;
  private isWritingSession = false;

  /** Every feature to choose from: the server's list, or the ones passed in until it arrives. */
  readonly allFeatures = computed(() =>
    this.featureData.rows().length ? this.featureData.rows() : this.initialFeatures(),
  );
  readonly featuresLoading = this.featureData.loading;
  readonly savedSessions = this.sessionData.rows;

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
  /** The selected features that exist in the list - ids of unknown features are ignored. */
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
          this.latestQuantityData.rows(),
        )
      : this.reportData.rows(),
  );
  readonly columns = computed(() => recordColumns(this.rows()));

  /** The status line: the last action's message, else the first background load that failed. */
  readonly message = computed(() => {
    if (this.statusMessage()) return this.statusMessage();
    if (this.featureData.error()) return 'Unable to load report parameters.';
    if (this.sessionData.error()) return 'Unable to load saved sessions.';
    if (this.latestQuantityData.error()) {
      return 'Latest issued quantities could not be loaded. Refresh to retry.';
    }
    return '';
  });

  /** Why no report can load yet, or `null` when the chosen features and dates are usable. */
  private readonly blocked = computed<ReportQuery<LicenseRecord> | null>(() => {
    if (!this.chosenFeatures().length) return { kind: 'idle' };
    if (!validPeriod(this.startDate(), this.endDate())) {
      return { kind: 'invalid', message: 'Choose valid dates with the start before the end.' };
    }
    return null;
  });

  constructor() {
    this.featureData.bind(() => ({
      kind: 'load',
      sql: 'call esms_m.r_report_view_1_select_parameters();',
    }));
    this.sessionData.bind(() => {
      const userId = this.reportData.userId();
      return userId
        ? { kind: 'load', sql: `call esms_m.r_report_view_1_load(${sqlString(userId)});` }
        : undefined;
    });
    this.reportData.bind(() => {
      const settings = this.filters.settings();
      if (!settings) return undefined;
      const blocked = this.blocked();
      if (blocked) return blocked;
      return {
        kind: 'load',
        sql: customReportCall({
          view: this.reportView(),
          start: this.startDate(),
          end: this.endDate(),
          features: this.chosenFeatures(),
          workingDays: this.workingDaysOnly(),
          details: this.showDetails(),
          workingHours: settings.workingHoursPerDay,
          usageMode: this.usageMode(),
        }),
        transform: (rows) => prepareCustomHours(rows, settings.workingHoursPerDay),
      };
    });
    this.latestQuantityData.bind(() => {
      if (!this.filters.settings() || this.blocked() || this.reportView() !== 'Percentile') {
        return { kind: 'idle' };
      }
      const payload = JSON.stringify(
        this.chosenFeatures().map((row) => ({ svr: row.server, ftr: row.lic })),
      );
      const suffix = this.showDetails() ? 'c' : 'p';
      return {
        kind: 'load',
        sql: `call esms_m.r_report_view_1_percentile_${suffix}_qty_i(${sqlString(payload)});`,
      };
    });
    registerLicenseRefresh(
      this.reportData,
      () => this.refresh(),
      () => this.statusControls(),
    );
  }

  ngOnInit(): void {
    void this.filters.start().then((settingsLoaded) => {
      if (!settingsLoaded) {
        this.reportData.fail(this.filters.error());
        return;
      }
      this.percentileRank.set(reportParameter(this.storage, 'percentile', 95));
      const dates = reportDates(this.storage, { start: this.startDate(), end: this.endDate() });
      this.startDate.set(dates.start);
      this.endDate.set(dates.end);
    });
  }

  refresh(): void {
    this.reportData.refresh();
    this.latestQuantityData.refresh();
  }

  loadFeatures(): void {
    this.featureData.refresh();
  }

  setRank(value: string): void {
    this.percentileRank.set(Math.min(100, Math.max(1, Number(value) || 95)));
  }

  toggleFeature(feature: ReportFeature): void {
    this.selectedFeatureIds.update((keys) => toggled(keys, featureId(feature)));
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
      const session = this.savedSessions().find((row) => String(row['no']) === sessionId);
      this.sessionName.set(String(session?.['session'] ?? ''));
      this.statusMessage.set('Session loaded.');
    } catch (error) {
      if (requestId === this.sessionRequestId) {
        this.statusMessage.set(errorText(error, 'Unable to load session.'));
      }
    } finally {
      if (requestId === this.sessionRequestId) this.isSavingSession.set(false);
    }
  }

  async saveSession(): Promise<void> {
    if (!this.sessionName().trim() || !this.chosenFeatures().length || this.isSavingSession()) {
      return;
    }
    await this.writeSession(
      sessionSaveCall(this.reportData.userId(), this.sessionName(), this.chosenFeatures()),
      'post_insert_update',
      'Session saved.',
      'Unable to save session.',
    );
  }

  async deleteSession(): Promise<void> {
    if (!this.selectedSessionId() || this.isSavingSession()) return;
    if (!window.confirm(`Delete saved session "${this.sessionName()}"?`)) return;
    const deleted = await this.writeSession(
      [`call esms_m.r_report_view_1_delete(${sqlString(this.selectedSessionId())});`],
      'post_delete',
      'Session deleted.',
      'Unable to delete session.',
    );
    if (deleted) {
      this.selectedSessionId.set('');
      this.sessionName.set('');
    }
  }

  /** Saves or deletes a session, then reloads the session list. Returns whether it worked. */
  private async writeSession(
    sql: string | string[],
    endpoint: string,
    doneMessage: string,
    failedMessage: string,
  ): Promise<boolean> {
    this.isSavingSession.set(true);
    this.isWritingSession = true;
    try {
      await this.api.send(endpoint, sql, failedMessage);
      this.statusMessage.set(doneMessage);
      this.sessionData.refresh();
      return true;
    } catch (error) {
      this.statusMessage.set(errorText(error, failedMessage));
      return false;
    } finally {
      this.isSavingSession.set(false);
      this.isWritingSession = false;
    }
  }

  private statusControls(): ReportControls {
    const settings = this.filters.settings();
    return {
      dates: {
        value: () => ({ start: this.startDate(), end: this.endDate() }),
        set: (dates) => {
          this.startDate.set(dates.start);
          this.endDate.set(dates.end);
        },
      },
      ...(settings
        ? {
            parameters: {
              value: () => ({
                usageHours: (this.filters.settings() ?? settings).workingHoursPerDay,
                ...(this.reportView() === 'Percentile'
                  ? { percentile: this.percentileRank() }
                  : {}),
              }),
              set: (values) => {
                if (values.usageHours !== undefined) {
                  this.filters.settings.update(
                    (current) => current && { ...current, workingHoursPerDay: values.usageHours! },
                  );
                }
                if (values.percentile !== undefined) this.percentileRank.set(values.percentile);
              },
            },
          }
        : {}),
    };
  }

  private async read<T>(sql: string): Promise<T[]> {
    const response = await apiRequest(this.api.call<T[]>(sql), this.destroyRef);
    if (response.status !== 'PASS' || !Array.isArray(response.message)) {
      throw new Error(
        typeof response.message === 'string' ? response.message : 'Unable to load report data.',
      );
    }
    return response.message;
  }
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}
