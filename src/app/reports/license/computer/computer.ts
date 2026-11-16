import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReportData, ReportQuery } from '../../../shared/report-data';
import { GRID_REPORT_IMPORTS, GridReport } from '../grid-report';
import { ComputerRow, computerCall, computerColumns } from './computer.data';

/** License / Computer - every license access and denial per computer. */
@Component({
  selector: 'app-license-computer',
  imports: GRID_REPORT_IMPORTS,
  templateUrl: '../grid-report.html',
  styleUrl: '../grid-report.scss',
  host: { class: 'report-page report-fill' },
  providers: [ReportData],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Computer extends GridReport<ComputerRow> {
  protected readonly label = 'Computer';
  protected readonly columns = computerColumns();

  protected query(): ReportQuery<ComputerRow> | undefined {
    const userId = this.reportData.userId();
    return userId ? { kind: 'load', sql: computerCall(userId) } : undefined;
  }
}
