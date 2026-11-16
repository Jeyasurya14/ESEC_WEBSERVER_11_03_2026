import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ReportData, ReportQuery } from '../../../shared/report-data';
import { GRID_REPORT_IMPORTS, GridReport } from '../grid-report';
import { GroupMemberRow, groupMemberCall, groupMemberColumns } from './group-member.data';

/** License / Group Member: who belongs to which license reservation group. No range or filters. */
@Component({
  selector: 'app-license-group-member',
  imports: GRID_REPORT_IMPORTS,
  templateUrl: '../grid-report.html',
  host: { class: 'report-page report-fill' },
  providers: [ReportData],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupMember extends GridReport<GroupMemberRow> {
  protected readonly label = 'Group member';
  protected readonly columns = groupMemberColumns();

  protected query(): ReportQuery<GroupMemberRow> {
    return { kind: 'load', sql: groupMemberCall() };
  }
}
