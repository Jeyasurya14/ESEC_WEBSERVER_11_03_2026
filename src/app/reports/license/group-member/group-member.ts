import { registerLicenseRefresh } from '../report-helpers';
import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { UserMenu } from '../../../core/models';
import { SearchFilter } from '../../../shared/filters/search-filter';
import { DataGrid } from '../../../shared/grid/data-grid';
import { ReportData } from '../../../shared/report-data';
import { GroupMemberRow, groupMemberCall, groupMemberColumns } from './group-member.data';

/** License / Group Member: who belongs to which license reservation group. No range or filters. */
@Component({
  selector: 'app-license-group-member',
  imports: [DataGrid, SearchFilter],
  templateUrl: './group-member.html',
  host: { class: 'report-page report-fill' },
  providers: [ReportData],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupMember implements OnInit {
  readonly menu = input.required<UserMenu>();
  readonly reportData = inject<ReportData<GroupMemberRow>>(ReportData);
  readonly searchText = signal('');
  readonly rowCount = signal('');
  readonly columns = groupMemberColumns();

  constructor() {
    registerLicenseRefresh(this.reportData, () => this.refresh());
  }

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    void this.reportData.load(groupMemberCall());
  }
}
