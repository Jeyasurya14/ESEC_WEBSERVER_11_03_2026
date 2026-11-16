import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { UserMenu } from '../../../core/models';
import { registerLicenseRefresh } from '../report-helpers';
import { SearchFilter } from '../../../shared/filters/search-filter';
import { DataGrid } from '../../../shared/grid/data-grid';
import { ReportData } from '../../../shared/report-data';
import { DebugDataRow, debugDataCall, debugDataColumns } from './debug-data.data';
import { DebugRecords } from './debug-records';

/** License / Debug Data - the licenses the data collector has debug records for. */
@Component({
  selector: 'app-license-debug-data',
  imports: [DataGrid, SearchFilter, DebugRecords],
  templateUrl: './debug-data.html',
  styleUrl: './debug-data.scss',
  host: { class: 'report-page report-fill' },
  providers: [ReportData],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DebugData implements OnInit {
  readonly menu = input.required<UserMenu>();
  readonly reportData = inject<ReportData<DebugDataRow>>(ReportData);
  readonly searchText = signal('');
  readonly rowCount = signal('');
  readonly selectedRow = signal<DebugDataRow | null>(null);
  readonly columns = debugDataColumns((row) => this.selectedRow.set({ ...row }));

  constructor() {
    registerLicenseRefresh(this.reportData, () => void this.reportData.load(debugDataCall()));
  }

  ngOnInit(): void {
    void this.reportData.load(debugDataCall());
  }
}
