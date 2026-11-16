import { registerLicenseRefresh } from '../report-helpers';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { UserMenu } from '../../../core/models';
import { FeatureGroupFilter } from '../../../shared/filters/feature-group-filter';
import { OptionFilter } from '../../../shared/filters/option-filter';
import { RangeFilter } from '../../../shared/filters/range-filter';
import { ReportFilters } from '../../../shared/filters/report-filters';
import { SearchFilter } from '../../../shared/filters/search-filter';
import { DataGrid } from '../../../shared/grid/data-grid';
import { ReportData } from '../../../shared/report-data';
import { DenialRow, denialCall, denialColumns } from './denial.data';

/** License / Denial: every feature's denials across the whole estate, not scoped to one row. */
@Component({
  selector: 'app-license-denial',
  imports: [DataGrid, FeatureGroupFilter, OptionFilter, RangeFilter, SearchFilter],
  templateUrl: './denial.html',
  host: { class: 'report-page report-fill' },
  providers: [ReportFilters, ReportData],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Denial implements OnInit {
  readonly menu = input.required<UserMenu>();
  readonly filters = inject(ReportFilters);
  readonly reportData = inject<ReportData<DenialRow>>(ReportData);
  readonly rowCount = signal('');
  readonly columns = denialColumns();

  constructor() {
    this.reportData.bind(() => {
      if (!this.filters.settings()) return undefined;
      return {
        kind: 'load',
        sql: denialCall(this.reportData.userId(), this.filters.range(), this.filters.featureGroup()),
      };
    });

    registerLicenseRefresh(this.reportData, () => this.refresh());
  }

  ngOnInit(): void {
    void this.start();
  }

  refresh(): void {
    if (this.filters.settings()) {
      this.reportData.refresh();
    } else {
      void this.start();
    }
  }

  private async start(): Promise<void> {
    if (!(await this.filters.start())) {
      this.reportData.fail(this.filters.error());
    }
  }
}
