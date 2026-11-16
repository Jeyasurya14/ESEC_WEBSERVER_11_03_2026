import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReportData, ReportQuery } from '../../../shared/report-data';
import { GRID_REPORT_IMPORTS, GridReport } from '../grid-report';
import { UserRow, userCall, userColumns } from './user.data';

/** License / User - every license access and denial per user. */
@Component({
  selector: 'app-license-user',
  imports: GRID_REPORT_IMPORTS,
  templateUrl: '../grid-report.html',
  styleUrl: '../grid-report.scss',
  host: { class: 'report-page report-fill' },
  providers: [ReportData],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class User extends GridReport<UserRow> {
  protected readonly label = 'User';
  protected readonly columns = userColumns();

  protected query(): ReportQuery<UserRow> | undefined {
    const userId = this.reportData.userId();
    return userId ? { kind: 'load', sql: userCall(userId) } : undefined;
  }
}
