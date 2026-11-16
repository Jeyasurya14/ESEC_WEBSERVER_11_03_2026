import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReportFilters } from '../../../shared/filters/report-filters';
import { ReportData } from '../../../shared/report-data';
import { FILTERED_GRID_REPORT_IMPORTS, FilteredGridReport } from '../grid-report';
import { BorrowRow, borrowCall, borrowColumns } from './borrow.data';

/** License / Borrow: every borrowed license across the whole estate, not scoped to one row. */
@Component({
  selector: 'app-license-borrow',
  imports: FILTERED_GRID_REPORT_IMPORTS,
  templateUrl: '../filtered-grid-report.html',
  host: { class: 'report-page report-fill' },
  providers: [ReportFilters, ReportData],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Borrow extends FilteredGridReport<BorrowRow> {
  protected readonly label = 'Borrow';
  protected readonly columns = borrowColumns();
  protected readonly call = borrowCall;
}
