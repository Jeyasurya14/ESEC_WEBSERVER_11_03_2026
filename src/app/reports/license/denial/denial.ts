import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReportFilters } from '../../../shared/filters/report-filters';
import { ReportData } from '../../../shared/report-data';
import { FILTERED_GRID_REPORT_IMPORTS, FilteredGridReport } from '../grid-report';
import { DenialRow, denialCall, denialColumns } from './denial.data';

/** License / Denial: every feature's denials across the whole estate, not scoped to one row. */
@Component({
  selector: 'app-license-denial',
  imports: FILTERED_GRID_REPORT_IMPORTS,
  templateUrl: '../filtered-grid-report.html',
  host: { class: 'report-page report-fill' },
  providers: [ReportFilters, ReportData],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Denial extends FilteredGridReport<DenialRow> {
  protected readonly label = 'Denial';
  protected readonly columns = denialColumns();
  protected readonly call = denialCall;
}
