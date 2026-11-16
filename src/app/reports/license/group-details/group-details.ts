import { inputValue } from '../../../shared/input-value';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { BrowserStorage } from '../../../core/storage/browser-storage.service';
import { Dropdown } from '../../../shared/dropdown/dropdown';
import { CheckFilter } from '../../../shared/filters/check-filter';
import { SearchFilter } from '../../../shared/filters/search-filter';
import { DataGrid } from '../../../shared/grid/data-grid';
import { ReportData, sqlQuery } from '../../../shared/report-data';
import { ReportSettings } from '../../../shared/report-settings.service';
import { OrganizationRow } from '../organization/organization.data';
import { DrilldownRange } from '../drilldown/drilldown-range';
import {
  LicenseRecord,
  isoDate,
  recordColumns,
  registerLicenseRefresh,
  validPeriod,
} from '../report-helpers';
import { LicenseScope } from '../grouped-reports';
import { GroupReportRequest, GroupReportView, groupReportCall } from './group-queries';
import { LicenseChart } from '../license-chart';
import {
  reportDates,
  reportParameter,
  reportTimes,
} from '../../../shared/status-bar/report-controls';

@Component({
  selector: 'app-group-details',
  imports: [DataGrid, Dropdown, CheckFilter, SearchFilter, LicenseChart],
  template: `
    <div class="report-toolbar" role="toolbar" aria-label="License detail filters">
      <app-search-filter [(text)]="searchText" />
      @if (view() !== 'department') {
        <label class="filter"
          ><span class="filter-label">From</span
          ><input type="date" [value]="startDate()" (change)="startDate.set(inputValue($event))"
        /></label>
        <label class="filter"
          ><span class="filter-label">To</span
          ><input type="date" [value]="endDate()" (change)="endDate.set(inputValue($event))"
        /></label>
      }
      @if (view() === 'utilization' || view() === 'checkoutCount') {
        <input
          type="time"
          aria-label="Start time"
          [value]="startTime()"
          (change)="startTime.set(inputValue($event))"
        />
        <input
          type="time"
          aria-label="End time"
          [value]="endTime()"
          (change)="endTime.set(inputValue($event))"
        />
      }
      @if (view() === 'utilization' || view() === 'hours') {
        <app-dropdown
          ariaLabel="Granularity"
          [options]="granularityOptions()"
          [value]="granularity()"
          (valueChange)="chooseGranularity($event)"
        />
      }
      @if (
        view() === 'usage' ||
        view() === 'utilizationHours' ||
        (view() === 'hours' && granularity() === 'month')
      ) {
        <app-check-filter
          label="Working Days"
          [checked]="workingDaysOnly()"
          (toggled)="workingDaysOnly.set(!workingDaysOnly())"
        />
      }
      @if (hasChart()) {
        <button type="button" class="action" (click)="showChart.set(!showChart())">
          {{ showChart() ? 'Grid View' : 'Chart View' }}
        </button>
      }
      <span class="toolbar-trailing row-count">Rows : {{ rows().length }}</span>
    </div>
    @if (showChart() && hasChart() && !reportData.loading() && !reportData.error()) {
      <app-license-chart
        [rows]="rows()"
        [search]="searchText()"
        [heatmap]="view() === 'heatmap'"
        [settings]="settings()"
      />
    } @else {
      <app-data-grid
        [rows]="rows()"
        [columns]="columns()"
        [search]="searchText()"
        [loading]="reportData.loading()"
        [emptyText]="reportData.error()"
        (rowCount)="rowCount.set($event)"
        (filtersCleared)="searchText.set('')"
      />
    }
  `,
  styleUrl: '../license-controls.scss',
  host: { class: 'report-page report-fill' },
  providers: [ReportData],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupDetails {
  protected readonly inputValue = inputValue;

  readonly row = input.required<OrganizationRow>();
  readonly scope = input.required<Exclude<LicenseScope, 'organization'>>();
  readonly view = input.required<GroupReportView>();
  readonly range = input.required<DrilldownRange>();
  readonly settings = input.required<ReportSettings>();
  readonly reportData = inject<ReportData<LicenseRecord>>(ReportData);
  private readonly storage = inject(BrowserStorage);
  private readonly rangeDates = computed(() =>
    reportDates(this.storage, {
      start: isoDate(this.range().startDate),
      end: isoDate(this.range().endDate),
    }),
  );
  // Reset from the inputs whenever they change, but stay editable from the toolbar.
  readonly startDate = linkedSignal(() => this.rangeDates().start);
  readonly endDate = linkedSignal(() => this.rangeDates().end);
  readonly startTime = signal(reportTimes(this.storage).startTime);
  readonly endTime = signal(reportTimes(this.storage).endTime);
  readonly workingHours = linkedSignal(() =>
    reportParameter(
      this.storage,
      this.view() === 'longDuration' ? 'longDuration' : 'usageHours',
      this.settings().workingHoursPerDay,
    ),
  );
  readonly workingDaysOnly = linkedSignal(() => this.range().workingDaysOnly);
  readonly granularity = signal<GroupReportRequest['granularity']>('date');
  readonly searchText = signal('');
  readonly showChart = signal(true);
  readonly rowCount = signal('');
  readonly hasChart = computed(() =>
    ['utilization', 'heatmap', 'hours', 'utilizationHours', 'date'].includes(this.view()),
  );
  readonly granularityOptions = computed(() =>
    (this.view() === 'hours' ? ['date', 'month'] : ['date', 'week', 'month', 'qtr', 'year']).map(
      (value) => ({
        value,
        label: value === 'qtr' ? 'Quarter' : value[0].toUpperCase() + value.slice(1),
      }),
    ),
  );
  readonly rows = computed(() =>
    this.view() === 'usage'
      ? this.reportData.rows().filter((row) => row['lic'] === this.row().lic)
      : this.reportData.rows(),
  );
  readonly columns = computed(() => recordColumns(this.rows()));
  private readonly reportQuery = computed(() => {
    if (!validPeriod(this.startDate(), this.endDate())) return null;
    return groupReportCall({
      row: this.row(),
      scope: this.scope(),
      view: this.view(),
      start: this.startDate(),
      end: this.endDate(),
      startTime: this.startTime(),
      endTime: this.endTime(),
      workingHours: this.workingHours(),
      workingDays: this.workingDaysOnly(),
      granularity: this.granularity(),
    });
  });
  constructor() {
    this.reportData.bind(() =>
      sqlQuery(this.reportQuery(), { kind: 'invalid', message: 'Choose a valid date range.' }),
    );
    registerLicenseRefresh(
      this.reportData,
      () => this.refresh(),
      () => ({
        ...(this.view() !== 'department'
          ? {
              dates: {
                value: () => ({ start: this.startDate(), end: this.endDate() }),
                set: (dates) => {
                  this.startDate.set(dates.start);
                  this.endDate.set(dates.end);
                },
              },
            }
          : {}),
        ...(['utilization', 'checkoutCount'].includes(this.view())
          ? {
              times: {
                value: () => ({
                  startTime: this.startTime().slice(0, 5),
                  endTime: this.endTime().slice(0, 5),
                }),
                set: (times) => {
                  this.startTime.set(times.startTime);
                  this.endTime.set(times.endTime);
                },
              },
            }
          : {}),
        ...(['hours', 'longDuration'].includes(this.view())
          ? {
              parameters: {
                value: () =>
                  this.view() === 'longDuration'
                    ? { longDuration: this.workingHours() }
                    : { usageHours: this.workingHours() },
                set: (values) => this.workingHours.set(values.longDuration ?? values.usageHours!),
              },
            }
          : {}),
      }),
    );
  }
  chooseGranularity(value: string): void {
    if (
      value === 'date' ||
      value === 'week' ||
      value === 'month' ||
      value === 'qtr' ||
      value === 'year'
    )
      this.granularity.set(value);
  }
  refresh(): void {
    this.reportData.refresh();
  }
}
