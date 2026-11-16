import {
  Column,
  columnGroup,
  dateColumn,
  formatNumber,
  numberColumn,
  textColumn,
} from '../../../../shared/grid/columns';
import { LicenseRecord } from '../../report-helpers';
import { ColDef } from 'ag-grid-community';

function userColumns(): Column<LicenseRecord>[] {
  return [
    textColumn('user_id', 'User Id'),
    textColumn('user_name', 'User Name', { hide: true }),
    textColumn('wksn', 'Computer'),
    textColumn('grouptype', 'Group Type', { hide: true }),
    textColumn('groupname', 'Group Name', { hide: true }),
    columnGroup('Start', [dateColumn('s_date', 'Date'), textColumn('s_time', 'Time')]),
  ];
}

function licenseHoursColumn(): ColDef<LicenseRecord> {
  return {
    colId: 'lic_hrs',
    headerName: 'License Hours',
    type: 'rightAligned',
    cellDataType: 'number',
    valueGetter: (cell) =>
      cell.data ? Number(cell.data['du']) * Number(cell.data['qty_u']) : null,
    valueFormatter: (cell) => formatNumber(cell.value),
  };
}

export function checkoutUserColumns(): Column<LicenseRecord>[] {
  return [
    ...userColumns(),
    columnGroup('Last Updated', [dateColumn('u_date', 'Date'), textColumn('u_time', 'Time')]),
    numberColumn('du', 'Hours Used'),
    licenseHoursColumn(),
    numberColumn('qty_u', 'Used'),
    numberColumn('qty_b', 'Borrow'),
  ];
}

export function borrowColumns(): Column<LicenseRecord>[] {
  return [
    ...userColumns(),
    numberColumn('qty_u', 'Used'),
    columnGroup('Last Updated', [dateColumn('u_date', 'Date'), textColumn('u_time', 'Time')]),
    numberColumn('du', 'Hours Used'),
  ];
}

export function denialColumns(): Column<LicenseRecord>[] {
  return [
    ...userColumns(),
    numberColumn('de', 'True Denial'),
    columnGroup('Denial Code', [
      textColumn('denial_major_code', 'Major'),
      textColumn('denial_full_code', 'Full'),
    ]),
    textColumn('data', 'Reason', { width: 550 }),
  ];
}
