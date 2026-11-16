import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';

import { UserMenu } from '../../../core/models';
import { registerLicenseRefresh } from '../report-helpers';
import { formatDate } from '../../../shared/dates';
import { CheckFilter } from '../../../shared/filters/check-filter';
import { DataGrid } from '../../../shared/grid/data-grid';
import { ReportData } from '../../../shared/report-data';
import { ReportSettings, ReportSettingsService } from '../../../shared/report-settings.service';
import {
  DAYS_IN_WEEK,
  HolidayRow,
  WeekReportRow,
  WeekUsageRow,
  holidayCall,
  holidaySet,
  pivotWeekRows,
  startOfWeek,
  weekCall,
  weekColumns,
  weekDates,
} from './organization-week.data';

/**
 * License / Organization By Week: one row per server/license, one column group per day of a
 * Sunday-to-Saturday week. Uses its own week stepper rather than the shared range filter, as the
 * company app's weekly status report does.
 */
@Component({
  selector: 'app-organization-week',
  imports: [CheckFilter, DataGrid],
  templateUrl: './organization-week.html',
  styleUrl: './organization-week.scss',
  host: { class: 'report-page report-fill' },
  providers: [ReportData],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrganizationWeek implements OnInit {
  readonly menu = input.required<UserMenu>();

  private readonly settingsService = inject(ReportSettingsService);
  protected readonly reportData = inject<ReportData<WeekReportRow>>(ReportData);

  protected readonly settings = signal<ReportSettings | null>(null);
  protected readonly weekStart = signal(startOfWeek(new Date()));
  protected readonly workingDaysOnly = signal(false);
  protected readonly primaryFeatureOnly = signal(false);
  private readonly holidayData = new ReportData<HolidayRow>();
  private readonly holidays = computed(() => holidaySet(this.holidayData.rows()));

  protected readonly weekDates = computed(() => weekDates(this.weekStart()));
  protected readonly weekLabel = computed(() => {
    const dates = this.weekDates();
    return `${formatDate(dates[0])} to ${formatDate(dates[dates.length - 1])}`;
  });
  protected readonly rows = computed<WeekUsageRow[]>(() =>
    pivotWeekRows(this.reportData.rows(), this.holidays()),
  );
  protected readonly columns = computed(() => {
    const settings = this.settings();
    return settings
      ? weekColumns(this.weekDates(), settings, this.holidays(), this.workingDaysOnly())
      : [];
  });

  constructor() {
    this.reportData.bind(() => {
      const settings = this.settings();
      if (!settings) return undefined;
      const dates = this.weekDates();
      return {
        kind: 'load',
        sql: weekCall(
          dates[0],
          dates[dates.length - 1],
          settings.workingHoursPerDay,
          this.primaryFeatureOnly(),
        ),
      };
    });
    this.holidayData.bind(() => {
      const dates = this.weekDates();
      return { kind: 'load', sql: holidayCall(dates[0], dates[dates.length - 1]) };
    });

    registerLicenseRefresh(this.reportData, () => {
      if (!this.settings()) {
        void this.ngOnInit();
        return;
      }
      this.reportData.refresh();
      this.holidayData.refresh();
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      this.settings.set(await this.settingsService.load());
    } catch {
      this.reportData.fail('Unable to load the report settings. Please refresh to try again.');
    }
  }

  protected stepWeek(direction: 1 | -1): void {
    this.weekStart.update((start) => {
      const next = new Date(start);
      next.setDate(start.getDate() + direction * DAYS_IN_WEEK);
      return next;
    });
  }
}
