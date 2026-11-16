import { inputValue } from '../../../shared/input-value';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { sqlString } from '../../../core/api/api.service';
import { SearchFilter } from '../../../shared/filters/search-filter';
import { DataGrid } from '../../../shared/grid/data-grid';
import { ReportData } from '../../../shared/report-data';
import { LicenseRecord, isoDate, recordColumns, serverDate, validPeriod } from '../report-helpers';
import { defaultPeriod } from '../license-agent/license-agent.data';
import { DebugDataRow } from './debug-data.data';

@Component({
  selector: 'app-license-debug-records',
  imports: [DataGrid, SearchFilter],
  host: { class: 'report-page report-fill' },
  providers: [ReportData],
  template: `
    <div class="report-toolbar" role="toolbar" aria-label="Debug record filters">
      <strong>{{ row().server }} / {{ row().lic }}</strong>
      <app-search-filter [(text)]="searchText" />
      <input
        type="date"
        aria-label="Debug start date"
        [value]="startDate()"
        (change)="startDate.set(inputValue($event))"
      />
      <input
        type="date"
        aria-label="Debug end date"
        [value]="endDate()"
        (change)="endDate.set(inputValue($event))"
      />
      <button type="button" class="action" (click)="refresh()">Refresh</button>
      <button type="button" class="action" (click)="closed.emit()">Close details</button>
    </div>
    <app-data-grid
      [rows]="reportData.rows()"
      [columns]="columns()"
      [search]="searchText()"
      [loading]="reportData.loading()"
      [emptyText]="reportData.error()"
    />
  `,
  styleUrl: '../license-controls.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DebugRecords {
  protected readonly inputValue = inputValue;

  readonly row = input.required<DebugDataRow>();
  readonly closed = output<void>();
  readonly reportData = inject<ReportData<LicenseRecord>>(ReportData);
  readonly searchText = signal('');
  readonly startDate = signal(isoDate(defaultPeriod(new Date()).startDate));
  readonly endDate = signal(isoDate(new Date()));
  readonly columns = computed(() => recordColumns(this.reportData.rows()));
  constructor() {
    effect(() => {
      this.row();
      this.startDate();
      this.endDate();
      untracked(() => this.refresh());
    });
  }
  refresh(): void {
    if (!validPeriod(this.startDate(), this.endDate())) {
      this.reportData.fail('Choose a valid date range.');
      return;
    }
    const queryArgs = [
      this.row().server,
      this.row().lic,
      serverDate(this.startDate()),
      serverDate(this.endDate()),
    ];
    void this.reportData.load(
      `call esms_m.r_license_debug_data_1(${queryArgs.map(sqlString).join(',')});`,
    );
  }
}
