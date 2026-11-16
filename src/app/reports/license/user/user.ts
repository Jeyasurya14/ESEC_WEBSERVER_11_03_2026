import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { UserMenu } from '../../../core/models';
import { registerLicenseRefresh } from '../report-helpers';
import { SearchFilter } from '../../../shared/filters/search-filter';
import { DataGrid } from '../../../shared/grid/data-grid';
import { ReportData } from '../../../shared/report-data';
import { UserRow, userCall, userColumns } from './user.data';

/** License / User - every license access and denial per user. */
@Component({
  selector: 'app-license-user',
  imports: [DataGrid, SearchFilter],
  templateUrl: './user.html',
  styleUrl: './user.scss',
  host: { class: 'report-page report-fill' },
  providers: [ReportData],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class User {
  readonly menu = input.required<UserMenu>();
  readonly reportData = inject<ReportData<UserRow>>(ReportData);
  readonly searchText = signal('');
  readonly rowCount = signal('');
  readonly columns = userColumns();

  constructor() {
    registerLicenseRefresh(
      this.reportData,
      () => void this.reportData.load(userCall(this.reportData.userId())),
    );
    effect(() => {
      const userId = this.reportData.userId();
      if (userId) {
        untracked(() => void this.reportData.load(userCall(userId)));
      }
    });
  }
}
