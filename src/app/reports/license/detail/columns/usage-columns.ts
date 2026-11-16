import {
  Column,
  columnGroup,
  dateColumn,
  numberColumn,
  percentColumn,
  textColumn,
} from '../../../../shared/grid/columns';
import { LicenseRecord } from '../../report-helpers';
import { BandLimits } from '../../../../shared/filters/usage-band-filter';

export function monthColumns(limits: BandLimits): Column<LicenseRecord>[] {
  return [
    dateColumn('c_month', 'Month'),
    numberColumn('qty_i', 'Issued Max'),
    numberColumn('qty_r', 'Reserved Max'),
    numberColumn('qty_db', 'Day Borrow'),
    columnGroup('Day Peak', [numberColumn('qty_dp', 'Qty'), percentColumn('p_dp', '%', limits)]),
    columnGroup('Work Peak', [numberColumn('qty_wp', 'Qty'), percentColumn('p_wp', '%', limits)]),
    columnGroup('License Hours', [
      numberColumn('used_hours', 'Used'),
      numberColumn('license_hours', 'Available'),
      percentColumn('p_used_hours', '%', limits),
    ]),
    numberColumn('di', 'Users'),
    numberColumn('td', 'True Denial'),
    numberColumn('count_days', 'Days'),
  ];
}

export function dateColumns(limits: BandLimits): Column<LicenseRecord>[] {
  return [
    dateColumn('date', 'Date'),
    textColumn('li_holi', 'Holiday'),
    numberColumn('qty_i', 'Issued'),
    numberColumn('qty_r', 'Reserved'),
    numberColumn('qty_db', 'Day Borrow'),
    columnGroup('Day Peak', [numberColumn('qty_dp', 'Qty'), percentColumn('p_dp', '%', limits)]),
    columnGroup('Day Avg', [numberColumn('qty_da', 'Qty'), percentColumn('p_da', '%', limits)]),
    columnGroup('Work Peak', [numberColumn('qty_wp', 'Qty'), percentColumn('p_wp', '%', limits)]),
    columnGroup('Work Avg', [numberColumn('qty_wa', 'Qty'), percentColumn('p_wa', '%', limits)]),
    columnGroup('License Hours', [
      numberColumn('tot_du_q', 'Used'),
      numberColumn('tlh_24', 'Available'),
      percentColumn('p_tot_du_q', '%', limits),
    ]),
    numberColumn('di', 'Users'),
    numberColumn('ndivn', 'Divisions'),
    numberColumn('ndept', 'Departments'),
    numberColumn('de', 'Denial Count'),
    numberColumn('ad', 'Denial Users'),
    numberColumn('td', 'True Denial'),
  ];
}

export function hoursColumns(granularity: 'month' | 'date'): Column<LicenseRecord>[] {
  const leadColumn: Column<LicenseRecord>[] =
    granularity === 'date'
      ? [dateColumn<LicenseRecord>('date', 'Date'), textColumn<LicenseRecord>('li_holi', 'Holiday')]
      : [dateColumn<LicenseRecord>('month', 'Month')];

  return [
    ...leadColumn,
    numberColumn('qty_i', 'Issued'),
    numberColumn('license_hours', 'License Hours'),
    numberColumn('di', 'Users'),
    numberColumn('used_hours', 'Used Hours'),
    numberColumn('work_hours', 'Work Hours'),
    numberColumn('license_hours_used', 'License Hours Used'),
    numberColumn('license_hours_work', 'License Hours Work'),
  ];
}

export function usageColumns(): Column<LicenseRecord>[] {
  return [
    textColumn('user_id', 'User Id'),
    textColumn('user_name', 'User Name'),
    textColumn('wksn', 'Computer'),
    textColumn('grouptype', 'Group Type', { hide: true }),
    textColumn('groupname', 'Group Name', { hide: true }),
    numberColumn('du', 'Day Usage'),
    numberColumn('p_du', '%'),
    numberColumn('dw', 'Day Work'),
    numberColumn('p_dw', '%'),
    numberColumn('du_q', 'License Hours'),
    numberColumn('dw_q', 'Work License Hours'),
    numberColumn('count_days', 'Days'),
    numberColumn('session', 'Sessions'),
  ];
}
