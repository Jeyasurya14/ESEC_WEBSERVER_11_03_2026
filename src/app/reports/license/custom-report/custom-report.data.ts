import { literal } from '../../../core/utils/data';
import { sqlString } from '../../../core/api/api.service';
import { percentile } from '../../../shared/percentile';
import { LicenseRecord, serverDate } from '../report-helpers';

export interface ReportFeature {
  sw: string;
  server: string;
  lic: string;
  lic_name: string;
  select?: string;
}
export const CUSTOM_REPORT_VIEWS = literal([
  'Utilization',
  'Merge',
  'Percentile',
  'Denial',
  'Borrow',
  'Usage',
  'License Month',
  'Dashboard',
  'Group',
  'Date',
  'Checkout User',
  'Long Duration',
  'Daywise Usage',
]);
export type CustomReportView = (typeof CUSTOM_REPORT_VIEWS)[number];
export interface CustomReportRequest {
  view: CustomReportView;
  start: string;
  end: string;
  features: ReportFeature[];
  workingDays: boolean;
  details: boolean;
  workingHours: number;
  usageMode: 'svr_ftr' | 'ftr' | 'join';
}

export function featureId(feature: Pick<ReportFeature, 'server' | 'lic'>): string {
  return JSON.stringify([feature.server, feature.lic]);
}

export function customReportCall(reportOptions: CustomReportRequest): string {
  const payload = JSON.stringify(
    reportOptions.features.map((row) => ({ svr: row.server, ftr: row.lic })),
  );
  const dates = [serverDate(reportOptions.start), serverDate(reportOptions.end)];
  const holiday = reportOptions.workingDays ? '' : 'Y';
  const suffix = reportOptions.details ? 'c' : 'p';
  let procedure: string;
  let queryArgs: string[];
  switch (reportOptions.view) {
    case 'Utilization':
    case 'Merge':
    case 'Percentile':
      procedure =
        reportOptions.view === 'Utilization'
          ? `utilization_${suffix}`
          : reportOptions.view === 'Merge'
            ? `utilization_merge_${suffix}`
            : `percentile_${suffix}`;
      queryArgs = [...dates, holiday, payload];
      break;
    case 'Dashboard':
    case 'Group':
    case 'License Month':
      procedure =
        reportOptions.view === 'License Month' ? 'license_month' : reportOptions.view.toLowerCase();
      queryArgs = [...dates, holiday, payload];
      break;
    case 'Usage':
      procedure = `usage_${reportOptions.usageMode}`;
      queryArgs = [...dates, payload, holiday];
      break;
    case 'Long Duration':
      procedure = 'long_duration';
      queryArgs = [...dates, String(reportOptions.workingHours), payload];
      break;
    default:
      procedure =
        reportOptions.view === 'Checkout User'
          ? 'checkout_user'
          : reportOptions.view === 'Daywise Usage'
            ? 'usage_summary'
            : reportOptions.view.toLowerCase();
      queryArgs = [...dates, payload];
  }
  return `call esms_m.r_report_view_1_${procedure}(${queryArgs.map(sqlString).join(',')});`;
}

export function customPercentiles(
  rows: LicenseRecord[],
  rank: number,
  details: boolean,
  quantities: LicenseRecord[] = [],
): LicenseRecord[] {
  const quantityByFeature = new Map<unknown, Map<unknown, LicenseRecord>>();
  for (const row of quantities) {
    const feature = row['lic_name'];
    const server = details ? row['server'] : undefined;
    const servers = quantityByFeature.get(feature) ?? new Map<unknown, LicenseRecord>();
    if (!servers.has(server)) servers.set(server, row);
    quantityByFeature.set(feature, servers);
  }
  const groups = new Map<string, { row: LicenseRecord; peaks: number[] }>();
  for (const row of rows) {
    const featureKey = JSON.stringify(
      details ? [row['lic_name'], row['server']] : [row['lic_name']],
    );
    const group = groups.get(featureKey) ?? {
      row: { lic_name: row['lic_name'], ...(details ? { server: row['server'] } : {}) },
      peaks: [],
    };
    group.peaks.push(Number(row['qty_dp']) || 0);
    groups.set(featureKey, group);
  }
  return [...groups.values()].map(({ row, peaks }) => {
    const peak = peaks.reduce((max, value) => Math.max(max, value), 0);
    const value = Number(percentile(peaks, rank).toFixed(1));
    const latest = quantityByFeature.get(row['lic_name'])?.get(details ? row['server'] : undefined);
    return {
      ...row,
      ...(latest
        ? { l_qty_i: latest['l_qty_i'], expiry: latest['expiry'], status: latest['status'] }
        : {}),
      dp: peak,
      nod_dp: peaks.filter((item) => item >= peak).length,
      percentile_dp: value,
      nod_percentile_dp: peaks.filter((item) => item >= value).length,
      nod: peaks.length,
    };
  });
}

export function prepareCustomHours(rows: LicenseRecord[], hours: number): LicenseRecord[] {
  return rows.map((row) => {
    if (row['tlh_24'] === undefined) return row;
    const available = (Number(row['tlh_24']) * hours) / 24;
    const percent = available
      ? Number(((Number(row['tot_du_q']) / available) * 100).toFixed(1))
      : 0;
    return { ...row, tlh_24: available, tot_du_q_per: percent, p_tot_du_q: percent };
  });
}

export function sessionSaveCall(userId: string, name: string, features: ReportFeature[]): string {
  const sessionFeatures = features.map((row) => ({ ...row, select: 'FT' }));
  return `call esms_m.r_report_view_1_save(${[userId, name.trim(), 'YTD|YTD', JSON.stringify(sessionFeatures)].map(sqlString).join(',')});`;
}
