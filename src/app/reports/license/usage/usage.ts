import { inputValue } from '../../../shared/input-value';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { UserMenu } from '../../../core/models';
import { Dropdown } from '../../../shared/dropdown/dropdown';
import { CheckFilter } from '../../../shared/filters/check-filter';
import { FeatureGroupFilter } from '../../../shared/filters/feature-group-filter';
import { ReportFilters } from '../../../shared/filters/report-filters';
import { SearchFilter } from '../../../shared/filters/search-filter';
import { DataGrid } from '../../../shared/grid/data-grid';
import { ReportData } from '../../../shared/report-data';
import {
  LicenseRecord,
  isoDate,
  recordColumns,
  registerLicenseRefresh,
  validPeriod,
} from '../report-helpers';
import { SoftwareListService } from '../software-list.service';
import {
  MatrixGroup,
  USAGE_VIEWS,
  UsageView,
  licenseUsageCall,
  prepareUsage,
  usageMatrix,
} from './usage.data';

@Component({
  selector: 'app-license-usage',
  imports: [DataGrid, Dropdown, CheckFilter, FeatureGroupFilter, SearchFilter],
  templateUrl: './usage.html',
  styleUrl: '../license-controls.scss',
  host: { class: 'report-page report-fill' },
  providers: [ReportData, ReportFilters],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Usage implements OnInit {
  protected readonly inputValue = inputValue;

  readonly menu = input.required<UserMenu>();
  readonly reportData = inject<ReportData<LicenseRecord>>(ReportData);
  readonly filters = inject(ReportFilters);
  private readonly softwareList = inject(SoftwareListService);
  readonly softwareOptions = signal<string[]>([]);
  readonly selectedSoftwareNames = signal<string[]>([]);
  readonly startDate = signal(isoDate(new Date(new Date().getFullYear(), 0, 1)));
  readonly endDate = signal(isoDate(new Date()));
  readonly workingDaysOnly = signal(true);
  readonly usageView = signal<UsageView>('Summary');
  readonly usageViews = USAGE_VIEWS;
  readonly matrixGroup = signal<MatrixGroup>('division');
  readonly groupOptions = [
    { value: 'division', label: 'Division' },
    { value: 'department', label: 'Department' },
    { value: 'group', label: 'Group' },
    { value: 'cluster', label: 'Cluster' },
  ];
  readonly rowCount = signal('');
  readonly softwareError = signal('');
  readonly rows = computed(() =>
    this.usageView() === 'Summary'
      ? this.reportData.rows()
      : usageMatrix(this.reportData.rows(), this.usageView(), this.matrixGroup()),
  );
  readonly columns = computed(() => recordColumns(this.rows()));
  readonly distinctUsers = computed(
    () =>
      new Set(
        this.reportData
          .rows()
          .map((row) =>
            String(row['user_id'] ?? '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ).size,
  );
  constructor() {
    this.reportData.bind(() => {
      const settings = this.filters.settings();
      if (!settings) return undefined;
      if (!this.selectedSoftwareNames().length) return { kind: 'idle' };
      if (!validPeriod(this.startDate(), this.endDate())) {
        return { kind: 'invalid', message: 'Choose valid dates with the start before the end.' };
      }
      return {
        kind: 'load',
        sql: licenseUsageCall(
          this.selectedSoftwareNames(),
          this.startDate(),
          this.endDate(),
          this.filters.featureGroup(),
          this.workingDaysOnly(),
        ),
        transform: (rows) => prepareUsage(rows, settings.workingHoursPerDay),
      };
    });
    registerLicenseRefresh(this.reportData, () => this.refresh());
  }
  ngOnInit(): void {
    void this.filters.start().then((settingsLoaded) => {
      if (!settingsLoaded) this.reportData.fail(this.filters.error());
    });
    void this.loadSoftware();
  }
  async loadSoftware(): Promise<void> {
    this.softwareError.set('');
    try {
      this.softwareOptions.set(await this.softwareList.load());
    } catch {
      this.softwareError.set('Unable to load software names. Use Retry to try again.');
    }
  }
  toggleSoftware(name: string): void {
    this.selectedSoftwareNames.update((names) =>
      names.includes(name) ? names.filter((value) => value !== name) : [...names, name],
    );
  }
  chooseGroup(group: string): void {
    if (group === 'division' || group === 'department' || group === 'group' || group === 'cluster')
      this.matrixGroup.set(group);
  }
  refresh(): void {
    this.reportData.refresh();
  }
}
