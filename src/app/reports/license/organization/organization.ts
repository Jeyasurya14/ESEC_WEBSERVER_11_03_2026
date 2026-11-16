import { registerLicenseRefresh } from '../report-helpers';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  PendingTasks,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { UserMenu } from '../../../core/models';
import { ExpiryFilter } from '../../../shared/filters/expiry-filter';
import { FeatureGroupFilter } from '../../../shared/filters/feature-group-filter';
import { OptionFilter } from '../../../shared/filters/option-filter';
import { RangeFilter, ReportRange } from '../../../shared/filters/range-filter';
import { ReportFilters } from '../../../shared/filters/report-filters';
import { SearchFilter } from '../../../shared/filters/search-filter';
import { ServerStatusFilter } from '../../../shared/filters/server-status-filter';
import { ALL_BANDS, UsageBandFilter } from '../../../shared/filters/usage-band-filter';
import { GaugeGrid } from '../../../shared/gauge/gauge-grid';
import { DataGrid, rowCountText } from '../../../shared/grid/data-grid';
import { ReportData, ReportQuery } from '../../../shared/report-data';
import { ReportSettings } from '../../../shared/report-settings.service';
import { LicenseDrilldown } from '../drilldown/license-drilldown';
import {
  OrganizationRow,
  OrganizationTile,
  prepareRows,
  searchTiles,
  visibleRows,
} from './organization.data';
import { groupedCall, groupedColumns, groupedTiles, reportScope } from '../grouped-reports';
import { organizationBreakdownCall } from '../drilldown/breakdown-queries';

export type OrganizationView = 'grid' | 'gauge';

export const ORGANIZATION_IMPORTS = [
  DataGrid,
  ExpiryFilter,
  FeatureGroupFilter,
  GaugeGrid,
  OptionFilter,
  LicenseDrilldown,
  RangeFilter,
  SearchFilter,
  ServerStatusFilter,
  UsageBandFilter,
];

@Component({
  selector: 'app-organization',
  imports: [...ORGANIZATION_IMPORTS],
  templateUrl: './organization.html',
  styleUrl: './organization.scss',
  host: { class: 'report-page report-fill' },
  providers: [ReportFilters, ReportData],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Organization implements OnInit {
  readonly menu = input.required<UserMenu>();
  readonly parentRow = input<OrganizationRow | null>(null);
  readonly initialRange = input<ReportRange | null>(null);
  readonly reportLevel = computed(() => reportScope(this.menu().subMenuName));
  readonly filters = inject(ReportFilters);
  private readonly pendingTasks = inject(PendingTasks);
  readonly reportData = inject<ReportData<OrganizationRow>>(ReportData);
  readonly rowCount = signal('');
  readonly viewMode = signal<OrganizationView>('grid');
  readonly gaugesReady = signal(true);

  readonly rows = computed(() => {
    const reportSettings = this.filters.settings();
    if (!reportSettings) {
      return [];
    }
    const filterChoices = {
      serverStatus: this.filters.serverStatus(),
      notExpired: this.filters.notExpired(),
      option: this.filters.option(),
      bands: this.filters.bands(),
    };
    return visibleRows(this.reportData.rows(), filterChoices, reportSettings, new Date());
  });

  readonly columns = computed(() => {
    const reportSettings = this.filters.settings();
    return reportSettings
      ? groupedColumns(this.reportLevel(), reportSettings, (row) => this.openDrilldownForRow(row))
      : [];
  });

  readonly gaugeCards = computed(() =>
    searchTiles(
      groupedTiles(this.rows(), this.filters.option(), this.reportLevel()),
      this.filters.search(),
    ),
  );

  readonly selectedGauge = signal<OrganizationTile | null>(null);

  readonly rowCountLabel = computed(() => {
    if (this.viewMode() === 'grid') {
      return this.rowCount();
    }
    const hasSearchText = this.filters.search().trim().length > 0;
    return rowCountText(this.gaugeCards().length, this.rows().length, hasSearchText);
  });

  constructor() {
    this.reportData.bind(() => {
      const reportSettings = this.filters.settings();
      return reportSettings ? this.query(reportSettings) : undefined;
    });

    registerLicenseRefresh(
      this.reportData,
      () => this.refresh(),
      () => ({
        range: { value: this.filters.range, set: (value) => this.filters.range.set(value) },
        ...(this.filters.settings()
          ? {
              parameters: {
                value: () => ({ usageHours: this.filters.settings()!.workingHoursPerDay }),
                set: (values) =>
                  this.filters.settings.update(
                    (settings) =>
                      settings && { ...settings, workingHoursPerDay: values.usageHours! },
                  ),
              },
            }
          : {}),
      }),
    );
  }

  ngOnInit(): void {
    this.pendingTasks.run(() => this.start());
  }

  refresh(): void {
    if (this.filters.settings()) {
      this.reportData.refresh();
    } else {
      this.pendingTasks.run(() => this.start());
    }
  }

  clearFilters(): void {
    this.filters.search.set('');
    this.filters.bands.set([...ALL_BANDS]);
  }

  toggleView(): void {
    const nextView = this.viewMode() === 'grid' ? 'gauge' : 'grid';
    this.viewMode.set(nextView);

    if (nextView === 'gauge') {
      this.gaugesReady.set(false);
      setTimeout(() => this.gaugesReady.set(true));
    }
  }

  openDrilldownForRow(row: OrganizationRow): void {
    const [tile] = groupedTiles([row], this.filters.option(), this.reportLevel());
    this.selectedGauge.set(tile ?? null);
  }

  openDrilldown(tile: OrganizationTile): void {
    this.selectedGauge.set({ ...tile });
  }

  private async start(): Promise<void> {
    if (!(await this.filters.start(this.initialRange() ?? undefined))) {
      this.reportData.fail(this.filters.error());
    }
  }

  private query(reportSettings: ReportSettings): ReportQuery<OrganizationRow> {
    const parent = this.parentRow();
    const reportLevel = this.reportLevel();
    const sql = parent
      ? organizationBreakdownCall(reportLevel, parent, this.filters.range())
      : groupedCall(
          reportLevel,
          this.reportData.userId(),
          this.filters.range(),
          this.filters.featureGroup(),
        );
    return {
      kind: 'load',
      sql,
      transform: (rows) =>
        prepareRows(
          rows.map((row) =>
            reportLevel === 'group' ? { ...row, qty_r: row.max_qty_r ?? row.qty_r } : row,
          ),
          reportSettings.workingHoursPerDay,
        ),
    };
  }
}
