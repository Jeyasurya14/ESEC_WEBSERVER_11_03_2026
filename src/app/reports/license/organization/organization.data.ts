import { isNotExpired } from '../../../shared/filters/expiry-filter';
import { featureGroupParam } from '../../../shared/filters/feature-group-filter';
import { UsageOption, percentField } from '../../../shared/filters/option-filter';
import { ReportRange, rangeCall } from '../../../shared/filters/range-filter';
import { ServerStatus, matchesServerStatus } from '../../../shared/filters/server-status-filter';
import { UsageBand, matchesBands } from '../../../shared/filters/usage-band-filter';
import {
  Column,
  columnGroup,
  compactColumn,
  dateColumn,
  numberColumn,
  percentColumn,
  rowNumberColumn,
  textColumn,
} from '../../../shared/grid/columns';
import { ReportSettings } from '../../../shared/report-settings.service';

export interface OrganizationRow {
  sw: string;
  server: string;
  location: string;
  lic: string;
  lic_name: string;
  l_qty_i: number;
  max_qty_i: number;
  l_qty_r: number;
  qty_r: number;
  qty_db: number;
  qty_dp: number;
  p_dp: number;
  qty_da: number;
  p_da: number;
  qty_dpm: number;
  p_dpm: number;
  qty_dam: number;
  p_dam: number;
  qty_wp: number;
  p_wp: number;
  qty_wa: number;
  p_wa: number;
  qty_wpm: number;
  p_wpm: number;
  qty_wam: number;
  p_wam: number;
  tot_du_q: number;
  tlh_24: number;
  per_tot_du_q: number;
  di: number;
  ndivn: number;
  ndept: number;
  de: number;
  ad: number;
  td: number;
  w_days: number;
  days: number;
  w_dp_days: number;
  dp_days: number;
  expiry: string;
  start_date: string;
  last_date: string;
  status: string;
  bundle: string;
}

export interface OrganizationFilters {
  serverStatus: ServerStatus;
  notExpired: boolean;
  option: UsageOption;
  bands: UsageBand[];
}

export function organizationCall(userId: string, range: ReportRange, featureGroup: string): string {
  return rangeCall(
    'esms_m.r_organization_grid',
    range,
    [userId],
    [featureGroupParam(featureGroup)],
  );
}

export function prepareRows(
  rows: OrganizationRow[],
  workingHoursPerDay: number,
): OrganizationRow[] {
  return rows.map((row) => {
    const available = Number(((Number(row.tlh_24) * workingHoursPerDay) / 24).toFixed(4));
    const used = Number(row.tot_du_q);
    const percentUsed = available !== 0 ? Number(((used / available) * 100).toFixed(1)) : 0;

    return { ...row, tlh_24: available, per_tot_du_q: percentUsed };
  });
}

export function visibleRows(
  rows: OrganizationRow[],
  filters: OrganizationFilters,
  settings: ReportSettings,
  today: Date,
): OrganizationRow[] {
  const percent = percentField(filters.option);

  return rows.filter(
    (row) =>
      matchesServerStatus(row.status, filters.serverStatus) &&
      (!filters.notExpired || isNotExpired(row.expiry, today)) &&
      matchesBands(row[percent], filters.bands, settings),
  );
}

export function organizationColumns(settings: ReportSettings): Column<OrganizationRow>[] {
  const usage = (headerName: string, option: Lowercase<UsageOption>, hide = false) =>
    columnGroup<OrganizationRow>(headerName, [
      numberColumn(`qty_${option}`, 'Qty', { width: 90, hide }),
      percentColumn(`p_${option}`, '%', settings, { width: 60, hide }),
    ]);

  return [
    rowNumberColumn(),
    textColumn('sw', 'Software', { width: 100, pinned: 'left' }),
    textColumn('server', 'Server', { width: 150, pinned: 'left' }),
    textColumn('location', 'Location', { width: 100, pinned: 'left', hide: true }),
    textColumn('lic', 'License', { width: 150, pinned: 'left', hide: true }),
    textColumn('lic_name', 'Feature', { width: 150, pinned: 'left' }),
    columnGroup('Issued', [
      numberColumn('l_qty_i', 'Last', { width: 100 }),
      numberColumn('max_qty_i', 'Max', { width: 100, hide: true }),
    ]),
    columnGroup('Reserved', [
      numberColumn('l_qty_r', 'Last', { width: 90 }),
      numberColumn('qty_r', 'Max', { width: 90, hide: true }),
    ]),
    numberColumn('qty_db', 'Borrow', { width: 80 }),
    usage('Day Peak', 'dp'),
    usage('Day Avg', 'da', true),
    usage('Day Peak Mean', 'dpm', true),
    usage('Day Avg Mean', 'dam', true),
    usage('Work Peak', 'wp'),
    usage('Work Avg', 'wa', true),
    usage('Work Peak Mean', 'wpm', true),
    usage('Work Avg Mean', 'wam', true),
    columnGroup(`License Hours - ${settings.workingHoursPerDay} Hrs`, [
      compactColumn('tot_du_q', 'Used', { width: 90 }),
      compactColumn('tlh_24', 'Available', { width: 100 }),
      percentColumn('per_tot_du_q', '%', settings, { width: 75 }),
    ]),
    numberColumn('di', 'User', { width: 60 }),
    numberColumn('ndivn', settings.divisionLabel, { width: 60 }),
    numberColumn('ndept', settings.departmentLabel, { width: 60 }),
    numberColumn('de', 'Denial Count', { width: 75, hide: true }),
    numberColumn('ad', 'Denial Users', { width: 75, hide: true }),
    numberColumn('td', 'True Denial', { width: 75 }),
    columnGroup('Days', [
      numberColumn('w_days', 'Working', { width: 90 }),
      numberColumn('days', 'License', { width: 90 }),
    ]),
    columnGroup('100%', [
      numberColumn('w_dp_days', 'Working', { width: 90, hide: true }),
      numberColumn('dp_days', 'License', { width: 90, hide: true }),
    ]),
    dateColumn('expiry', 'Expiry', { width: 100 }),
    dateColumn('start_date', 'Enrolled Date', { width: 140, hide: true }),
    dateColumn('last_date', 'Collected Date', { width: 140 }),
    textColumn('status', 'Status', { width: 85 }),
    textColumn('bundle', 'Primary', {
      width: 100,
      hide: true,
      suppressColumnsToolPanel: true,
      suppressFiltersToolPanel: true,
    }),
  ];
}
