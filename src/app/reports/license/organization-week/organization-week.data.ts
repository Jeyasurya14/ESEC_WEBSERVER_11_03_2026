import { ColDef } from 'ag-grid-community';
import { sqlString } from '../../../core/api/api.service';
import { formatDate, formatSqlDate } from '../../../shared/dates';
import { BandLimits } from '../../../shared/filters/usage-band-filter';
import {
  Column,
  columnGroup,
  numberColumn,
  percentColumn,
  rowNumberColumn,
  textColumn,
} from '../../../shared/grid/columns';

/** One license on one date, as `r_organization_week_report` returns it. */
export interface WeekReportRow {
  sw: string;
  server: string;
  lic: string;
  date: string;
  qty_i: number;
  qty_dp: number;
  di: number;
  used_lic_hours: number;
  avail_lic_hours: number;
  p_dw_q: number;
  li_holi: string;
}

/** One holiday, as `r_load_holiday_list` returns it. */
export interface HolidayRow {
  DATE: string;
  REMARKS: string;
}

export interface WeekPeriodValue {
  issued: number;
  dayPeak: number;
  users: number;
  usedHours: number;
  availableHours: number;
  percent: number;
  isHoliday: boolean;
}

/** One software/server/license row, with its per-date values keyed by `periodKey(date)`. */
export interface WeekUsageRow {
  sw: string;
  server: string;
  lic: string;
  periods: Record<string, WeekPeriodValue>;
}

export const DAYS_IN_WEEK = 7;

/** The display key used to match returned dates to their grid columns. */
export function periodKey(date: Date): string {
  return formatDate(date);
}

/** The Sunday that starts the week `date` falls in, as the company app's week report does. */
export function startOfWeek(date: Date): Date {
  const sunday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  sunday.setDate(sunday.getDate() - sunday.getDay());
  return sunday;
}

export function weekDates(weekStart: Date): Date[] {
  return Array.from({ length: DAYS_IN_WEEK }, (_, offset) => {
    const date = new Date(weekStart);
    date.setDate(weekStart.getDate() + offset);
    return date;
  });
}

export function weekCall(
  startDate: Date,
  endDate: Date,
  workingHoursPerDay: number,
  primaryFeatureOnly: boolean,
): string {
  const queryArgs = [
    formatSqlDate(startDate),
    formatSqlDate(endDate),
    String(workingHoursPerDay),
    primaryFeatureOnly ? 'Y' : '',
  ];
  return `call esms_m.r_organization_week_report(${queryArgs.map(sqlString).join(',')});`;
}

export function holidayCall(startDate: Date, endDate: Date): string {
  const queryArgs = [formatSqlDate(startDate), formatSqlDate(endDate)];
  return `call esms.r_load_holiday_list(${queryArgs.map(sqlString).join(',')});`;
}

/**
 * Turns the procedure's one-row-per-license-per-date result into one row per server/license,
 * with each date's values under `periods[periodKey(date)]`. A date counts as a holiday if the
 * row itself says so (`li_holi`) or the holiday list includes it.
 */
export function pivotWeekRows(
  rows: readonly WeekReportRow[],
  holidays: ReadonlySet<string>,
): WeekUsageRow[] {
  const byLicense = new Map<string, WeekUsageRow>();

  for (const row of rows) {
    const licenseKey = `${row.server}_${row.lic}`;
    let usageRow = byLicense.get(licenseKey);
    if (!usageRow) {
      usageRow = { sw: row.sw, server: row.server, lic: row.lic, periods: {} };
      byLicense.set(licenseKey, usageRow);
    }

    const dateKey = formatDate(row.date);
    usageRow.periods[dateKey] = {
      issued: Number(row.qty_i) || 0,
      dayPeak: Number(row.qty_dp) || 0,
      users: Number(row.di) || 0,
      usedHours: Number(row.used_lic_hours) || 0,
      availableHours: Number(row.avail_lic_hours) || 0,
      percent: Number(row.p_dw_q) || 0,
      isHoliday: String(row.li_holi).toLowerCase() === 'y' || holidays.has(dateKey),
    };
  }

  return [...byLicense.values()];
}

export function holidaySet(rows: readonly HolidayRow[]): Set<string> {
  return new Set(rows.map((row) => formatDate(row.DATE)));
}

function periodHeader(date: Date): string {
  const weekday = date.toLocaleDateString('en-US', { weekday: 'short' });
  return `${weekday} ${periodKey(date)}`;
}

function periodValue<K extends keyof WeekPeriodValue>(dateKey: string, field: K) {
  return (cell: { data?: WeekUsageRow }) => cell.data?.periods[dateKey]?.[field] ?? null;
}

export function weekColumns(
  dates: readonly Date[],
  limits: BandLimits,
  holidays: ReadonlySet<string>,
  workingDaysOnly: boolean,
): Column<WeekUsageRow>[] {
  const dateGroups = dates
    .filter((date) => !(workingDaysOnly && holidays.has(periodKey(date))))
    .map((date) => {
      const dateKey = periodKey(date);
      const valueOf = (field: keyof WeekPeriodValue): Partial<ColDef<WeekUsageRow>> => ({
        colId: `${dateKey}.${field}`,
        valueGetter: periodValue(dateKey, field),
      });
      const header = holidays.has(dateKey) ? `${periodHeader(date)} (Holiday)` : periodHeader(date);

      return columnGroup<WeekUsageRow>(header, [
        numberColumn(undefined, 'Issued', { width: 80, ...valueOf('issued') }),
        numberColumn(undefined, 'Day Peak', { width: 80, ...valueOf('dayPeak') }),
        numberColumn(undefined, 'Users', { width: 70, ...valueOf('users') }),
        numberColumn(undefined, 'Used Hrs', { width: 85, ...valueOf('usedHours') }),
        numberColumn(undefined, 'Avail Hrs', { width: 85, ...valueOf('availableHours') }),
        percentColumn(undefined, '%', limits, { width: 70, ...valueOf('percent') }),
      ]);
    });

  return [
    rowNumberColumn(),
    textColumn('sw', 'Software', { width: 100, pinned: 'left' }),
    textColumn('server', 'Server', { width: 150, pinned: 'left' }),
    textColumn('lic', 'License', { width: 150, pinned: 'left' }),
    ...dateGroups,
  ];
}
