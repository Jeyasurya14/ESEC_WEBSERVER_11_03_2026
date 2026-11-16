import { sqlString } from '../../../core/api/api.service';
import { MONTHS } from '../../../shared/dates';
import { UsageOption, quantityField } from '../../../shared/filters/option-filter';
import {
  Column,
  columnGroup,
  numberColumn,
  percentColumn,
  rowNumberColumn,
  textColumn,
} from '../../../shared/grid/columns';
import { ReportSettings } from '../../../shared/report-settings.service';
import { LicenseRecord } from '../report-helpers';

export type ComparisonMode = 'year' | 'month' | 'compare';

export interface ComparisonRequest {
  mode: ComparisonMode;
  years: number[];
  startMonth: string;
  endMonth: string;
  compareYear: number;
  primary: boolean;
}

export function comparisonMonths(start: string, end: string): { year: number; month: number }[] {
  if (!/^\d{4}-\d{2}$/.test(start) || !/^\d{4}-\d{2}$/.test(end) || start > end) return [];
  const [year, month] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);
  if (month < 1 || month > 12 || endMonth < 1 || endMonth > 12) return [];
  const count = (endYear - year) * 12 + endMonth - month + 1;
  if (count > 60) return [];
  return Array.from({ length: count }, (_, monthOffset) => {
    const date = new Date(year, month - 1 + monthOffset, 1);
    return { year: date.getFullYear(), month: date.getMonth() + 1 };
  });
}

export function comparisonCall(reportOptions: ComparisonRequest): string {
  const primaryFlag = reportOptions.primary ? 'Y' : '';
  let suffix: number;
  let queryArgs: string[];
  if (reportOptions.mode === 'year') {
    suffix = 1;
    queryArgs = [
      JSON.stringify(reportOptions.years.map((year) => ({ year: String(year) }))),
      primaryFlag,
    ];
  } else if (reportOptions.mode === 'month') {
    suffix = 2;
    queryArgs = [
      JSON.stringify(comparisonMonths(reportOptions.startMonth, reportOptions.endMonth)),
      primaryFlag,
    ];
  } else {
    suffix = 3;
    const [year, month] = reportOptions.startMonth.split('-');
    queryArgs = [String(reportOptions.compareYear), year, String(Number(month)), primaryFlag];
  }
  return `call esms_m.r_organization_year_month_${suffix}_server(${queryArgs.map(sqlString).join(',')});`;
}

export function comparisonPeriods(reportOptions: ComparisonRequest): string[] {
  const monthLabel = ({ year, month }: { year: number; month: number }) =>
    `${MONTHS[month - 1].toUpperCase()}-${year}`;
  if (reportOptions.mode === 'year')
    return [...reportOptions.years]
      .sort((firstValue, secondValue) => firstValue - secondValue)
      .map(String);
  if (reportOptions.mode === 'month')
    return comparisonMonths(reportOptions.startMonth, reportOptions.endMonth).map(monthLabel);
  const [year, month] = reportOptions.startMonth.split('-').map(Number);
  return [String(reportOptions.compareYear), monthLabel({ year, month })];
}

export function pivotComparison(rows: LicenseRecord[], option: UsageOption): LicenseRecord[] {
  const grouped = new Map<string, LicenseRecord>();
  for (const row of rows) {
    const licenseKey = JSON.stringify([row['server'], row['lic']]).toLowerCase();
    const target = grouped.get(licenseKey) ?? {
      server: row['server'],
      lic: row['lic'],
      status: row['status'],
    };
    const period = String(row['month_year'] || row['value'])
      .toUpperCase()
      .replaceAll(' ', '');
    const issued = Number(row['qty_i']);
    const value = Number(row[quantityField(option)]);
    target[`${period}:issued`] = row['qty_i'];
    target[`${period}:value`] = row[quantityField(option)];
    target[`${period}:percent`] =
      issued && Number.isFinite(value) ? Number(((value / issued) * 100).toFixed(1)) : 0;
    target[`${period}:users`] = row['di'];
    grouped.set(licenseKey, target);
  }
  return [...grouped.values()];
}

export function comparisonColumns(
  periods: string[],
  option: UsageOption,
  settings: ReportSettings,
): Column<LicenseRecord>[] {
  return [
    rowNumberColumn(),
    textColumn('server', 'Server', { pinned: 'left' }),
    textColumn('lic', 'License', { pinned: 'left' }),
    textColumn('status', 'Status'),
    ...periods.map((period) =>
      columnGroup<LicenseRecord>(period, [
        numberColumn(`${period}:issued`, 'Issued'),
        numberColumn(`${period}:value`, option),
        percentColumn(`${period}:percent`, '%', settings),
        numberColumn(`${period}:users`, 'Users'),
      ]),
    ),
  ];
}
