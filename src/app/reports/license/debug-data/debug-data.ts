import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { ReportData, ReportQuery } from '../../../shared/report-data';
import { GRID_REPORT_IMPORTS, GridReport } from '../grid-report';
import { DebugDataRow, debugDataCall, debugDataColumns } from './debug-data.data';
import { DebugRecords } from './debug-records';

/** License / Debug Data - the licenses the data collector has debug records for. */
@Component({
  selector: 'app-license-debug-data',
  imports: [...GRID_REPORT_IMPORTS, DebugRecords],
  templateUrl: './debug-data.html',
  styleUrl: '../grid-report.scss',
  host: { class: 'report-page report-fill' },
  providers: [ReportData],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DebugData extends GridReport<DebugDataRow> {
  protected readonly label = 'Debug data';
  protected readonly selectedRow = signal<DebugDataRow | null>(null);
  protected readonly columns = debugDataColumns((row) => this.selectedRow.set({ ...row }));

  protected query(): ReportQuery<DebugDataRow> {
    return { kind: 'load', sql: debugDataCall() };
  }
}
