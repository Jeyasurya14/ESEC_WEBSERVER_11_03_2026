import { sqlString } from '../../../core/api/api.service';
import { formatSqlDate } from '../../../shared/dates';
import {
  Column,
  columnGroup,
  numberColumn,
  rowNumberColumn,
  textColumn,
} from '../../../shared/grid/columns';

export interface LicenseAgentRow {
  wksn: string;
  type: string;
  server: string;
  lic: string;
  user_id: string;
  user_name: string;
  divn: string;
  dept: string;
  g_type: string;
  g_name: string;
  count_days: number;
  du: number;
  du_percent: number;
  work: number;
  work_percent: number;
  total: number;
  total_percent: number;
}

/** The company app's default period for this report: the last 30 days, today included. */
export const DEFAULT_PERIOD_DAYS = 30;

export function defaultPeriod(today: Date): { startDate: Date; endDate: Date } {
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - (DEFAULT_PERIOD_DAYS - 1));
  return { startDate, endDate: today };
}

export function licenseAgentCall(
  softwareName: string,
  startDate: Date,
  endDate: Date,
  workingHoursPerDay: number,
): string {
  const queryArgs = [
    softwareName,
    formatSqlDate(startDate),
    formatSqlDate(endDate),
    String(workingHoursPerDay),
  ];
  return `call esms_m.r_license_agent_sw(${queryArgs.map(sqlString).join(',')});`;
}

export function licenseAgentColumns(
  divisionLabel: string,
  departmentLabel: string,
): Column<LicenseAgentRow>[] {
  const hoursAndPercent = (
    headerName: string,
    hours: 'du' | 'work' | 'total',
    hoursLabel: string,
  ) =>
    columnGroup<LicenseAgentRow>(headerName, [
      numberColumn(hours, hoursLabel, { width: 90 }),
      numberColumn(`${hours}_percent`, '%', { width: 70 }),
    ]);

  return [
    rowNumberColumn(),
    textColumn('wksn', 'Computer', { width: 150, pinned: 'left' }),
    textColumn('type', 'License Type', { width: 110 }),
    textColumn('server', 'Server', { width: 150 }),
    textColumn('lic', 'Feature', { width: 150 }),
    columnGroup('User', [
      textColumn('user_id', 'User Id', { width: 120 }),
      textColumn('user_name', 'User Name', { width: 150 }),
      textColumn('divn', divisionLabel, { width: 100 }),
      textColumn('dept', departmentLabel, { width: 100 }),
    ]),
    columnGroup('Group', [
      textColumn('g_type', 'Group Type', { width: 110 }),
      textColumn('g_name', 'Group Name', { width: 130 }),
    ]),
    numberColumn('count_days', 'Days', { width: 70 }),
    hoursAndPercent('License Used', 'du', 'Used'),
    hoursAndPercent('Work', 'work', 'Hours'),
    hoursAndPercent('Total', 'total', 'Hours'),
  ];
}
