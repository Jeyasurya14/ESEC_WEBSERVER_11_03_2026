import { sqlString } from '../../../core/api/api.service';
import { parseDate } from '../../../shared/dates';
import { OrganizationRow } from '../organization/organization.data';
import { LicenseRecord, validPeriod } from '../report-helpers';

export type DetailView =
  | 'utilization'
  | 'history'
  | 'qos'
  | 'heatmap'
  | 'month'
  | 'date'
  | 'hours'
  | 'usage'
  | 'utilizationHours'
  | 'checkoutUser'
  | 'checkoutCount'
  | 'longDuration'
  | 'denial'
  | 'borrow'
  | 'assetInfo'
  | 'debugData';
export interface DetailParameters {
  start: string;
  end: string;
  startTime: string;
  endTime: string;
  workingDays: boolean;
  workingHours: number;
  businessHours: boolean;
  granularity: 'date' | 'week' | 'month' | 'qtr' | 'year' | 'scatter';
  usageView: 'summary' | 'daywise' | 'session' | 'matrix';
  checkoutView: 'date' | 'time';
  category: 'date' | 'points';
  reduction: number;
  newCalculation: boolean;
}
export interface DetailDefinition {
  title: string;
  chart: boolean;
  times?: boolean;
  workingDays?: boolean;
  hours?: boolean;
  granularities?: readonly DetailParameters['granularity'][];
}
export const DETAIL_DEFINITIONS: Record<DetailView, DetailDefinition> = {
  utilization: {
    title: 'Utilization',
    chart: true,
    times: true,
    workingDays: true,
    granularities: ['date', 'week', 'month', 'qtr', 'year', 'scatter'],
  },
  history: { title: 'History', chart: true, workingDays: true },
  qos: { title: 'QOS', chart: true, workingDays: true, hours: true, times: true },
  heatmap: { title: 'Heatmap', chart: true, workingDays: true },
  month: { title: 'Month', chart: false, workingDays: true, hours: true },
  date: { title: 'Date', chart: false },
  hours: {
    title: 'Hours',
    chart: true,
    workingDays: true,
    hours: true,
    granularities: ['date', 'month'],
  },
  usage: { title: 'Usage', chart: false, workingDays: true },
  utilizationHours: {
    title: 'Utilization and Hours',
    chart: true,
    workingDays: true,
    hours: true,
    granularities: ['date', 'month'],
  },
  checkoutUser: { title: 'Checkout User', chart: false, times: true },
  checkoutCount: { title: 'Checkout Count', chart: true, times: true, workingDays: true },
  longDuration: { title: 'Long Duration', chart: false, hours: true },
  denial: { title: 'Denial', chart: false },
  borrow: { title: 'Borrow', chart: false },
  assetInfo: { title: 'Asset Info', chart: false, workingDays: true, hours: true },
  debugData: { title: 'Debug Data', chart: false },
};

function call(procedure: string, queryArgs: (string | number)[]): string {
  return `call esms_m.r_${procedure}(${queryArgs.map((value) => sqlString(String(value))).join(',')});`;
}
export function validDetailParameters(reportOptions: DetailParameters): boolean {
  const clock = /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;
  return (
    validPeriod(reportOptions.start, reportOptions.end) &&
    clock.test(reportOptions.startTime) &&
    clock.test(reportOptions.endTime) &&
    reportOptions.startTime < reportOptions.endTime &&
    Number.isFinite(reportOptions.workingHours) &&
    reportOptions.workingHours > 0 &&
    Number.isFinite(reportOptions.reduction) &&
    reportOptions.reduction >= 1
  );
}

/** Exact Organization procedure variants and flag conventions from the company components. */
export function detailQuery(
  view: DetailView,
  row: OrganizationRow,
  reportOptions: DetailParameters,
  extraReport = false,
): string | null {
  if (!validDetailParameters(reportOptions)) return null;
  const identity = [row.server, row.lic];
  const dates = [reportOptions.start, reportOptions.end];
  const holiday = reportOptions.workingDays ? '' : 'Y';
  const excludedHoliday = reportOptions.workingDays ? 'N' : 'Y';
  const business = reportOptions.businessHours ? 'W' : '';
  if (extraReport) {
    if (view === 'history') return call('organization_history_1', [...identity, ...dates, holiday]);
    if (view === 'qos')
      return call('organization_qos_1', [
        ...identity,
        reportOptions.businessHours ? '' : '24',
        holiday,
        reportOptions.reduction,
        ...dates,
      ]);
    if (view === 'utilizationHours')
      return call(
        `organization_usage_utilization_${reportOptions.granularity === 'month' ? `month_${reportOptions.newCalculation ? 2 : 1}` : 'date_1'}`,
        [...identity, ...dates, business, excludedHoliday],
      );
    return null;
  }
  switch (view) {
    case 'utilization':
      if (!DETAIL_DEFINITIONS.utilization.granularities!.includes(reportOptions.granularity))
        return null;
      return reportOptions.granularity === 'scatter'
        ? call('organization_utilization_scatter', [...identity, ...dates, 'y'])
        : call(`organization_utilization_${reportOptions.granularity}`, [
            ...identity,
            ...dates,
            reportOptions.startTime,
            reportOptions.endTime,
          ]);
    case 'history':
      return call('organization_history', [
        ...identity,
        ...dates,
        holiday,
        reportOptions.reduction,
      ]);
    case 'qos':
      return call('organization_qos', [
        ...identity,
        reportOptions.category === 'date' ? 'date' : '',
        reportOptions.businessHours ? '' : '24',
        holiday,
        reportOptions.reduction,
        ...dates,
        reportOptions.businessHours ? reportOptions.startTime : '00:00',
        reportOptions.businessHours ? reportOptions.endTime : '24:00',
      ]);
    case 'heatmap':
      return call('organization_utilization_hour', [...identity, ...dates]);
    case 'month':
      return call('organization_month', [
        ...identity,
        ...dates,
        reportOptions.workingHours,
        excludedHoliday,
      ]);
    case 'date':
      return call('organization_date', [...identity, ...dates]);
    case 'hours':
      return call(
        `organization_usage_${reportOptions.granularity === 'month' ? 'month' : 'date'}`,
        [
          ...identity,
          ...dates,
          reportOptions.workingHours,
          ...(reportOptions.granularity === 'month' ? [excludedHoliday] : []),
        ],
      );
    case 'usage': {
      const suffix =
        reportOptions.usageView === 'daywise'
          ? '_1'
          : reportOptions.usageView === 'session'
            ? '_2'
            : '';
      return call(`organization_usage${suffix}`, [
        row.server,
        'All',
        ...dates,
        ...(!suffix ? [reportOptions.workingDays ? '' : 'Y'] : []),
      ]);
    }
    case 'utilizationHours':
      return call('organization_usage_utilization_date_2', [
        ...identity,
        ...dates,
        excludedHoliday,
      ]);
    case 'checkoutUser':
      return call(
        `organization_users_checkout_list_${reportOptions.checkoutView === 'time' ? 'date_time' : 'date'}`,
        [
          ...identity,
          ...dates,
          ...(reportOptions.checkoutView === 'time'
            ? [reportOptions.startTime, reportOptions.endTime]
            : []),
        ],
      );
    case 'longDuration':
      return call('organization_users_checkout_list_duration', [
        ...identity,
        ...dates,
        reportOptions.workingHours,
      ]);
    case 'checkoutCount':
      return call('organization_users_checkout_date', [
        ...identity,
        ...dates,
        reportOptions.startTime,
        reportOptions.endTime,
      ]);
    case 'denial':
      return call('organization_users_denial_users', [...identity, ...dates]);
    case 'borrow':
      return call('organization_users_borrow', [...identity, ...dates]);
    case 'assetInfo':
      return call('organization_utilization_asset_info', [
        row.server,
        ...dates,
        business,
        excludedHoliday,
      ]);
    case 'debugData':
      return call('organization_debug_data', [...identity, ...dates]);
  }
}

export function debugSessionQuery(
  row: LicenseRecord,
  reportOptions: DetailParameters,
): string | null {
  return validDetailParameters(reportOptions) && row['server'] && row['lic']
    ? call('license_debug_data_1', [
        String(row['server']),
        String(row['lic']),
        reportOptions.start,
        reportOptions.end,
      ])
    : null;
}
export function holidayRow(row: LicenseRecord): boolean {
  return ['holi_date', 'holi', 'li_holi', 'c_holi'].some((field) =>
    ['y', 'yes', 'holiday'].includes(String(row[field] ?? '').toLowerCase()),
  );
}
export function rowDate(row: LicenseRecord): Date | null {
  return parseDate(String(row['date'] ?? row['c_date'] ?? ''));
}
