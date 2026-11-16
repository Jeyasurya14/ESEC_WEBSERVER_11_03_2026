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
import { ComputerRow, computerCall, computerColumns } from './computer.data';

/** License / Computer - every license access and denial per computer. */
@Component({
  selector: 'app-license-computer',
  imports: [DataGrid, SearchFilter],
  templateUrl: './computer.html',
  styleUrl: './computer.scss',
  host: { class: 'report-page report-fill' },
  providers: [ReportData],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Computer {
  readonly menu = input.required<UserMenu>();
  readonly reportData = inject<ReportData<ComputerRow>>(ReportData);
  readonly searchText = signal('');
  readonly rowCount = signal('');
  readonly columns = computerColumns();

  constructor() {
    registerLicenseRefresh(
      this.reportData,
      () => void this.reportData.load(computerCall(this.reportData.userId())),
    );
    effect(() => {
      const userId = this.reportData.userId();
      if (userId) {
        untracked(() => void this.reportData.load(computerCall(userId)));
      }
    });
  }
}
