import { Directive, OnInit, inject, input, signal } from '@angular/core';
import { UserMenu } from '../../core/models';
import { FeatureGroupFilter } from '../../shared/filters/feature-group-filter';
import { OptionFilter } from '../../shared/filters/option-filter';
import { RangeFilter, ReportRange } from '../../shared/filters/range-filter';
import { ReportFilters } from '../../shared/filters/report-filters';
import { SearchFilter } from '../../shared/filters/search-filter';
import { Column } from '../../shared/grid/columns';
import { DataGrid } from '../../shared/grid/data-grid';
import { ReportData, ReportQuery } from '../../shared/report-data';
import { registerLicenseRefresh } from './report-helpers';

export const GRID_REPORT_IMPORTS = [DataGrid, SearchFilter];
export const FILTERED_GRID_REPORT_IMPORTS = [
  DataGrid,
  FeatureGroupFilter,
  OptionFilter,
  RangeFilter,
  SearchFilter,
];

@Directive()
export abstract class GridReport<T> {
  readonly menu = input.required<UserMenu>();
  protected readonly reportData = inject<ReportData<T>>(ReportData);
  protected readonly searchText = signal('');
  protected readonly rowCount = signal('');

  protected abstract readonly label: string;
  protected abstract readonly columns: Column<T>[];

  protected abstract query(): ReportQuery<T> | undefined;

  constructor() {
    this.reportData.bind(() => this.query());
    registerLicenseRefresh(this.reportData, () => this.refresh());
  }

  protected refresh(): void {
    this.reportData.refresh();
  }
}

@Directive()
export abstract class FilteredGridReport<T> extends GridReport<T> implements OnInit {
  protected readonly filters = inject(ReportFilters);

  protected abstract readonly call: (
    userId: string,
    range: ReportRange,
    featureGroup: string,
  ) => string;

  ngOnInit(): void {
    void this.start();
  }

  protected query(): ReportQuery<T> | undefined {
    if (!this.filters.settings()) return undefined;
    const sql = this.call(
      this.reportData.userId(),
      this.filters.range(),
      this.filters.featureGroup(),
    );
    return { kind: 'load', sql };
  }

  protected override refresh(): void {
    if (this.filters.settings()) this.reportData.refresh();
    else void this.start();
  }

  private async start(): Promise<void> {
    if (!(await this.filters.start())) this.reportData.fail(this.filters.error());
  }
}
