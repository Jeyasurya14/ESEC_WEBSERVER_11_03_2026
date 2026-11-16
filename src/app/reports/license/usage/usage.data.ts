import { sqlString } from '../../../core/api/api.service';
import { featureGroupParam } from '../../../shared/filters/feature-group-filter';
import { LicenseRecord, serverDate } from '../report-helpers';

export type UsageView = 'Summary' | 'Matrix Sw Svr Ftr' | 'Matrix Sw Svr' | 'Matrix Sw';
export type MatrixGroup = 'division' | 'department' | 'group' | 'cluster';
export const USAGE_VIEWS: UsageView[] = [
  'Summary',
  'Matrix Sw Svr Ftr',
  'Matrix Sw Svr',
  'Matrix Sw',
];

export function licenseUsageCall(
  software: string[],
  start: string,
  end: string,
  group: string,
  workingDays: boolean,
): string {
  const queryArgs = [
    JSON.stringify(software.map((softwareName) => ({ sw: softwareName }))),
    serverDate(start),
    serverDate(end),
    featureGroupParam(group),
    workingDays ? '' : 'Y',
  ];
  return `call esms_m.r_license_usage_sw(${queryArgs.map(sqlString).join(',')});`;
}

export function prepareUsage(rows: LicenseRecord[], workingHours: number): LicenseRecord[] {
  return rows.map((row) => {
    const available = Number(row['count_days']) * workingHours;
    const percent = (field: string) =>
      available > 0 ? Number((((Number(row[field]) || 0) / available) * 100).toFixed(1)) : 0;
    return { ...row, p_du: percent('du'), p_dw: percent('dw') };
  });
}

/** Matrix shares use each software/server/feature total as the denominator, as in the source. */
export function usageMatrix(
  rows: LicenseRecord[],
  view: UsageView,
  group: MatrixGroup,
): LicenseRecord[] {
  const dimensions =
    view === 'Matrix Sw'
      ? ['sw']
      : view === 'Matrix Sw Svr'
        ? ['sw', 'server']
        : ['sw', 'server', 'lic'];
  const groups =
    group === 'division'
      ? ['divn']
      : group === 'department'
        ? ['divn', 'dept']
        : group === 'group'
          ? ['g_type', 'g_name']
          : ['clus'];
  const keyFor = (row: LicenseRecord, fields: string[]) =>
    JSON.stringify(
      fields.map((field) =>
        String(row[field] ?? '')
          .trim()
          .toLowerCase(),
      ),
    );
  const totals = new Map<string, LicenseRecord>();
  const results = new Map<string, { row: LicenseRecord; users: Set<string> }>();
  const metrics = ['du', 'dw', 'du_q', 'dw_q'];
  for (const row of rows) {
    const totalKey = keyFor(row, dimensions);
    const key = keyFor(row, [...dimensions, ...groups]);
    const result = results.get(key) ?? {
      row: Object.fromEntries(
        [...dimensions, ...groups].map((field) => [field, row[field] || 'Not Available']),
      ),
      users: new Set<string>(),
    };
    const total = totals.get(totalKey) ?? {};
    for (const metric of metrics) {
      result.row[metric] = Number(result.row[metric] || 0) + Number(row[metric] || 0);
      total[metric] = Number(total[metric] || 0) + Number(row[metric] || 0);
    }
    if (row['user_id']) result.users.add(String(row['user_id']).trim().toLowerCase());
    results.set(key, result);
    totals.set(totalKey, total);
  }
  return [...results.values()].map(({ row, users }) => {
    const total = totals.get(keyFor(row, dimensions)) ?? {};
    const percentages = Object.fromEntries(
      metrics.map((metric) => [
        `p_${metric}`,
        Number(total[metric])
          ? Number(((Number(row[metric]) / Number(total[metric])) * 100).toFixed(2))
          : 0,
      ]),
    );
    return { ...row, ...percentages, users: users.size };
  });
}
