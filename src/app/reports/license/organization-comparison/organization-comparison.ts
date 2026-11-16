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
import { OptionFilter } from '../../../shared/filters/option-filter';
import { SearchFilter } from '../../../shared/filters/search-filter';
import {
  ServerStatusFilter,
  matchesServerStatus,
} from '../../../shared/filters/server-status-filter';
import { ReportFilters } from '../../../shared/filters/report-filters';
import { DataGrid } from '../../../shared/grid/data-grid';
import { ReportData } from '../../../shared/report-data';
import { LicenseRecord, isoDate, registerLicenseRefresh } from '../report-helpers';
import {
  ComparisonMode,
  ComparisonRequest,
  comparisonCall,
  comparisonColumns,
  comparisonMonths,
  comparisonPeriods,
  pivotComparison,
} from './organization-comparison.data';

@Component({
  selector: 'app-organization-comparison',
  imports: [DataGrid, Dropdown, CheckFilter, OptionFilter, SearchFilter, ServerStatusFilter],
  templateUrl: './organization-comparison.html',
  styleUrl: '../license-controls.scss',
  host: { class: 'report-page report-fill' },
  providers: [ReportData, ReportFilters],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationComparison implements OnInit {
  protected readonly inputValue = inputValue;

  readonly menu = input.required<UserMenu>();
  readonly filters = inject(ReportFilters);
  readonly reportData = inject<ReportData<LicenseRecord>>(ReportData);
  readonly comparisonMode = signal<ComparisonMode>('year');
  readonly comparisonModes = [
    { value: 'year', label: 'Year' },
    { value: 'month', label: 'Month' },
    { value: 'compare', label: 'Year vs Month' },
  ];
  readonly years = signal(`${new Date().getFullYear() - 1}, ${new Date().getFullYear()}`);
  readonly startMonth = signal(isoDate(new Date(new Date().getFullYear(), 0, 1)).slice(0, 7));
  readonly endMonth = signal(isoDate(new Date()).slice(0, 7));
  readonly compareYear = signal(new Date().getFullYear() - 1);
  readonly primaryFeaturesOnly = signal(false);
  readonly rowCount = signal('');
  readonly reportRequest = computed<ComparisonRequest>(() => ({
    mode: this.comparisonMode(),
    years: [
      ...new Set(
        this.years()
          .split(',')
          .map((year) => Number(year.trim()))
          .filter((year) => Number.isInteger(year) && year >= 2000 && year <= 2100),
      ),
    ],
    startMonth: this.startMonth(),
    endMonth: this.endMonth(),
    compareYear: this.compareYear(),
    primary: this.primaryFeaturesOnly(),
  }));
  readonly validationError = computed(() => {
    const reportOptions = this.reportRequest();
    if (reportOptions.mode === 'year')
      return reportOptions.years.length && reportOptions.years.length <= 10
        ? ''
        : 'Enter up to 10 years, separated by commas.';
    if (
      !comparisonMonths(
        reportOptions.startMonth,
        reportOptions.mode === 'compare' ? reportOptions.startMonth : reportOptions.endMonth,
      ).length
    )
      return 'Choose a valid month range of up to 60 months.';
    return reportOptions.mode === 'compare' &&
      (!Number.isInteger(reportOptions.compareYear) ||
        reportOptions.compareYear < 2000 ||
        reportOptions.compareYear > 2100)
      ? 'Choose a valid comparison year.'
      : '';
  });
  readonly rows = computed(() =>
    pivotComparison(this.reportData.rows(), this.filters.option()).filter((row) =>
      matchesServerStatus(String(row['status'] ?? ''), this.filters.serverStatus()),
    ),
  );
  readonly columns = computed(() => {
    const settings = this.filters.settings();
    return settings && !this.validationError()
      ? comparisonColumns(comparisonPeriods(this.reportRequest()), this.filters.option(), settings)
      : [];
  });
  constructor() {
    this.reportData.bind(() => {
      if (!this.filters.settings()) return undefined;
      const message = this.validationError();
      return message
        ? { kind: 'invalid', message }
        : { kind: 'load', sql: comparisonCall(this.reportRequest()) };
    });
    registerLicenseRefresh(this.reportData, () => this.refresh());
  }
  ngOnInit(): void {
    void this.filters.start().then((settingsLoaded) => {
      if (!settingsLoaded) this.reportData.fail(this.filters.error());
    });
  }
  refresh(): void {
    this.reportData.refresh();
  }
  chooseMode(mode: string): void {
    if (mode === 'year' || mode === 'month' || mode === 'compare') this.comparisonMode.set(mode);
  }
}
