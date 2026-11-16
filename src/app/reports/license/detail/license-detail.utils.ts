import type { LicenseRecord } from '../report-helpers';
import { DETAIL_DEFINITIONS, DetailParameters, DetailView, holidayRow } from './detail-queries';
import { groupUsage, usageMatrix } from './usage-analysis';

export type DetailLayout = 'grid' | 'chart' | 'split';

/** Hours views open with grid and chart side by side; other chart views on the chart. */
export function defaultLayout(view: DetailView): DetailLayout {
  if (view === 'hours' || view === 'utilizationHours') return 'split';
  return DETAIL_DEFINITIONS[view].chart ? 'chart' : 'grid';
}

/** The grid's rows: a usage matrix, the rows grouped by `groupField`, or the rows as they are. */
export function detailGridRows(
  rows: LicenseRecord[],
  view: DetailView,
  usageView: DetailParameters['usageView'],
  groupField: string,
): LicenseRecord[] {
  if (view === 'usage' && usageView === 'matrix') return usageMatrix(rows, groupField || 'divn');
  if (groupField) return groupUsage(rows, groupField);
  return rows;
}

/** The columns whose cells are links that drill into the clicked row. */
export function detailLinkFields(view: DetailView, groupField: string): string[] {
  if (groupField) return [groupField];
  if (view === 'usage') return ['user_id'];
  if (view === 'debugData') return ['lic'];
  return [];
}

const WORKDAY_VIEWS = new Set<DetailView>(['usage', 'heatmap', 'utilization', 'checkoutCount']);

export type DetailSelectField = keyof Pick<
  DetailParameters,
  'granularity' | 'checkoutView' | 'usageView' | 'category'
>;
type DetailChoices = { readonly [K in DetailSelectField]: readonly DetailParameters[K][] };
export const DETAIL_CHOICES: DetailChoices = {
  granularity: ['date', 'week', 'month', 'qtr', 'year', 'scatter'],
  checkoutView: ['date', 'time'],
  usageView: ['summary', 'daywise', 'session', 'matrix'],
  category: ['date', 'points'],
} satisfies DetailChoices;

export function detailRows(
  rows: LicenseRecord[],
  view: DetailView,
  parameters: DetailParameters,
  license: string,
  selectedUser: string,
): LicenseRecord[] {
  const workingDays = WORKDAY_VIEWS.has(view) && parameters.workingDays;
  const filtered =
    view === 'usage' || workingDays || selectedUser
      ? rows.filter((row) => {
          if (view === 'usage' && row['lic'] && row['lic'] !== license) return false;
          if (workingDays && holidayRow(row)) return false;
          return !selectedUser || row['user_id'] === selectedUser;
        })
      : rows;
  if (view !== 'date') return filtered;
  return filtered.map((row) => {
    const available = ((Number(row['tlh_24']) || 0) * parameters.workingHours) / 24;
    return {
      ...row,
      tlh_24: Number(available.toFixed(4)),
      p_tot_du_q: available
        ? Number((((Number(row['tot_du_q']) || 0) / available) * 100).toFixed(1))
        : 0,
    };
  });
}

export function selectedDetailRows(
  rows: LicenseRecord[],
  selection: LicenseRecord | null,
  view: DetailView,
  field: string,
): LicenseRecord[] {
  if (!selection || view === 'debugData') return [];
  if (selection['allUsers']) return rows;
  return rows.filter((row) =>
    field
      ? (String(row[field] ?? '') || 'Not Available') === selection[field] &&
        (field !== 'dept' || row['divn'] === selection['divn']) &&
        (field !== 'g_name' || row['g_type'] === selection['g_type'])
      : row === selection,
  );
}

export function detailUsageStats(
  chartRows: readonly LicenseRecord[],
  rows: readonly LicenseRecord[],
) {
  let available = 0;
  let used = 0;
  for (const row of chartRows) {
    available += Number(row['license_hours']) || 0;
    used += Number(row['used_hours']) || 0;
  }
  const users = new Set<LicenseRecord[string]>();
  for (const row of rows) if (row['user_id']) users.add(row['user_id']);
  return {
    count: rows.length,
    available,
    used,
    percentage: available ? (used / available) * 100 : 0,
    users: users.size,
  };
}
